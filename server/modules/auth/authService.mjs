import crypto from "node:crypto";
import path from "node:path";
import { createSaasStore } from "../saas/store.mjs";
import { listPublicPlans, getInternalCostAudit, TRIAL_DAYS } from "../saas/plans.mjs";

export function createAuthService({ auth, isProduction, rootDir }) {
  const dataDir = path.join(rootDir || process.cwd(), "data");
  const store = createSaasStore({
    dataDir,
    adminUsername: auth.username,
    adminPassword: auth.password,
  });
  store.ensureLoaded();

  const challenges = new Map();
  const sessions = new Map();
  const attempts = new Map();

  function startLogin({ username, password, ip, userAgent }) {
    cleanup();
    const attemptKey = String(ip || "unknown");
    const attempt = attempts.get(attemptKey);
    if (attempt?.lockedUntil && attempt.lockedUntil > Date.now()) {
      return {
        ok: false,
        status: 429,
        error: "Kirish vaqtincha bloklandi. Birozdan keyin qayta urinib ko'ring.",
        retryAfterSeconds: Math.ceil((attempt.lockedUntil - Date.now()) / 1000),
      };
    }

    const result = store.authenticate(username, password);
    if (!result) {
      const failure = recordFailure(attemptKey);
      return {
        ok: false,
        status: failure.lockedUntil ? 429 : 401,
        error: failure.lockedUntil
          ? "Urinishlar limiti tugadi. Kirish vaqtincha bloklandi."
          : "Login yoki parol noto'g'ri.",
        attemptsRemaining: Math.max(0, auth.maxAttempts - failure.count),
        retryAfterSeconds: failure.lockedUntil ? Math.ceil((failure.lockedUntil - Date.now()) / 1000) : undefined,
      };
    }

    if (!result.user.isSuperAdmin && result.org) {
      const access = store.orgAccessAllowed(result.org);
      if (!access.ok && access.reason === "org_suspended") {
        return { ok: false, status: 403, error: "Tashkilot to'xtatilgan. Super admin bilan bog'laning." };
      }
    }

    attempts.delete(attemptKey);
    const challengeToken = randomToken();
    const expiresAt = Date.now() + auth.challengeTtlMs;
    challenges.set(challengeToken, {
      userId: result.user.id,
      orgId: result.org?.id || null,
      ip,
      userAgent,
      expiresAt,
    });

    return {
      ok: true,
      challengeToken,
      expiresAt: new Date(expiresAt).toISOString(),
      user: store.publicUser(result.user, result.org, result.membership),
      security: {
        sessionMinutes: Math.round(auth.sessionTtlMs / 60_000),
        protectedApi: true,
        httpOnlySession: true,
      },
    };
  }

  function completeLogin({ challengeToken, ip, userAgent }) {
    cleanup();
    const challenge = challenges.get(String(challengeToken || ""));
    if (!challenge || challenge.expiresAt <= Date.now()) {
      return { ok: false, status: 401, error: "Tasdiqlash sessiyasi tugagan. Qayta kiring." };
    }
    if (challenge.ip !== ip || challenge.userAgent !== userAgent) {
      challenges.delete(challengeToken);
      return { ok: false, status: 401, error: "Qurilma tasdiqlanmadi. Qayta kiring." };
    }

    challenges.delete(challengeToken);
    const user = store.getUserById(challenge.userId);
    if (!user || user.status === "disabled") {
      return { ok: false, status: 401, error: "Foydalanuvchi topilmadi." };
    }
    const org = challenge.orgId ? store.getOrgById(challenge.orgId) : store.primaryOrgForUser(user);
    const membership = org ? store.getMembership(user.id, org.id) : null;

    const sessionToken = randomToken();
    const csrfToken = randomToken();
    const expiresAt = Date.now() + auth.sessionTtlMs;
    sessions.set(sessionToken, {
      userId: user.id,
      orgId: org?.id || null,
      csrfToken,
      userAgent,
      createdAt: Date.now(),
      expiresAt,
    });

    return {
      ok: true,
      sessionToken,
      session: sessionPayload(sessions.get(sessionToken)),
    };
  }

  function register({ email, password, fullName, organizationName, preferredPlan, ip, userAgent }) {
    cleanup();
    const result = store.register({ email, password, fullName, organizationName, preferredPlan });
    if (!result.ok) return result;

    const challengeToken = randomToken();
    const expiresAt = Date.now() + auth.challengeTtlMs;
    challenges.set(challengeToken, {
      userId: result.user.id,
      orgId: result.org.id,
      ip,
      userAgent,
      expiresAt,
    });

    return {
      ok: true,
      challengeToken,
      expiresAt: new Date(expiresAt).toISOString(),
      user: store.publicUser(result.user, result.org, result.membership),
      organization: store.orgSummaryForSession(result.org),
      trialDays: TRIAL_DAYS,
      security: {
        sessionMinutes: Math.round(auth.sessionTtlMs / 60_000),
        protectedApi: true,
        httpOnlySession: true,
      },
    };
  }

  function getSession(req) {
    cleanup();
    const token = readCookie(req, auth.cookieName);
    const session = token ? sessions.get(token) : null;
    if (!session || session.expiresAt <= Date.now()) {
      if (token) sessions.delete(token);
      return null;
    }
    if (session.userAgent !== requestUserAgent(req)) {
      sessions.delete(token);
      return null;
    }
    const user = store.getUserById(session.userId);
    if (!user || user.status === "disabled") {
      sessions.delete(token);
      return null;
    }
    return { token, value: session, user };
  }

  function requireSession(req, res, next) {
    const current = getSession(req);
    if (!current) {
      return res.status(401).json({ error: "Sessiya tugagan. Qayta kiring." });
    }
    if (!isSafeMethod(req.method) && !safeText.equal(String(req.get("x-csrf-token") || ""), current.value.csrfToken)) {
      return res.status(403).json({ error: "Xavfsizlik tokeni noto'g'ri. Sahifani yangilang." });
    }
    const user = current.user;
    const org = current.value.orgId ? store.getOrgById(current.value.orgId) : store.primaryOrgForUser(user);
    const membership = org ? store.getMembership(user.id, org.id) : null;
    req.auth = {
      token: current.token,
      user: store.publicUser(user, org, membership),
      csrfToken: current.value.csrfToken,
      org,
      isSuperAdmin: Boolean(user.isSuperAdmin),
      store,
    };
    return next();
  }

  function requireSuperAdmin(req, res, next) {
    requireSession(req, res, () => {
      if (!req.auth?.isSuperAdmin) {
        return res.status(403).json({ error: "Faqat super admin." });
      }
      return next();
    });
  }

  function destroySession(req) {
    const token = readCookie(req, auth.cookieName);
    if (token) sessions.delete(token);
  }

  function sessionCookie(token) {
    const maxAge = Math.max(1, Math.floor(auth.sessionTtlMs / 1000));
    return `${auth.cookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${isProduction ? "; Secure" : ""}`;
  }

  function clearCookie() {
    return `${auth.cookieName}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${isProduction ? "; Secure" : ""}`;
  }

  function sessionPayload(session) {
    const user = store.getUserById(session.userId);
    if (!user) {
      return null;
    }
    const org = session.orgId ? store.getOrgById(session.orgId) : store.primaryOrgForUser(user);
    const membership = org ? store.getMembership(user.id, org.id) : null;
    return {
      user: store.publicUser(user, org, membership),
      csrfToken: session.csrfToken,
      expiresAt: new Date(session.expiresAt).toISOString(),
      organization: user.isSuperAdmin ? null : store.orgSummaryForSession(org),
      trialDays: TRIAL_DAYS,
    };
  }

  function recordFailure(key) {
    const now = Date.now();
    const current = attempts.get(key);
    const withinWindow = current && now - current.startedAt < auth.attemptWindowMs;
    const count = withinWindow ? current.count + 1 : 1;
    const next = {
      count,
      startedAt: withinWindow ? current.startedAt : now,
      lockedUntil: count >= auth.maxAttempts ? now + auth.lockoutMs : null,
    };
    attempts.set(key, next);
    return next;
  }

  function cleanup() {
    const now = Date.now();
    for (const [token, challenge] of challenges) {
      if (challenge.expiresAt <= now) challenges.delete(token);
    }
    for (const [token, session] of sessions) {
      if (session.expiresAt <= now) sessions.delete(token);
    }
    for (const [key, attempt] of attempts) {
      if ((attempt.lockedUntil || attempt.startedAt + auth.attemptWindowMs) <= now) attempts.delete(key);
    }
  }

  function assertCanAnalyze(req) {
    if (req.auth?.isSuperAdmin) return { ok: true, reason: "super_admin" };
    const org = req.auth?.org;
    return store.canAnalyze(org);
  }

  function recordAnalysisUsage(req) {
    if (req.auth?.isSuperAdmin) return null;
    const orgId = req.auth?.org?.id;
    return store.incrementAnalysis(orgId, 1);
  }

  return {
    startLogin,
    completeLogin,
    register,
    getSession,
    requireSession,
    requireSuperAdmin,
    destroySession,
    sessionCookie,
    clearCookie,
    sessionPayload,
    listPublicPlans,
    getInternalCostAudit,
    store,
    assertCanAnalyze,
    recordAnalysisUsage,
  };
}

function randomToken() {
  return crypto.randomBytes(32).toString("hex");
}

function requestUserAgent(req) {
  return String(req.get("user-agent") || "unknown").slice(0, 500);
}

function readCookie(req, name) {
  const cookies = String(req.headers.cookie || "").split(";");
  for (const cookie of cookies) {
    const [key, ...value] = cookie.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

function isSafeMethod(method) {
  return method === "GET" || method === "HEAD" || method === "OPTIONS";
}

const safeText = {
  equal(a, b) {
    const left = Buffer.from(String(a || ""));
    const right = Buffer.from(String(b || ""));
    if (left.length !== right.length) return false;
    return crypto.timingSafeEqual(left, right);
  },
};
