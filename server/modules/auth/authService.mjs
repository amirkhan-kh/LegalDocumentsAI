import crypto from "node:crypto";

export function createAuthService({ auth, isProduction }) {
  const passwordSalt = crypto.randomBytes(24);
  const expectedPasswordHash = hashPassword(auth.password, passwordSalt);
  const challenges = new Map();
  const sessions = new Map();
  const attempts = new Map();

  function startLogin({ username, password, ip, userAgent }) {
    cleanup();
    const normalizedUsername = String(username || "").trim().toLowerCase();
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

    const validUsername = safeTextEqual(normalizedUsername, auth.username.toLowerCase());
    const validPassword = safeBufferEqual(hashPassword(String(password || ""), passwordSalt), expectedPasswordHash);
    if (!validUsername || !validPassword) {
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

    attempts.delete(attemptKey);
    const challengeToken = randomToken();
    const expiresAt = Date.now() + auth.challengeTtlMs;
    challenges.set(challengeToken, {
      username: auth.username,
      ip,
      userAgent,
      expiresAt,
    });

    return {
      ok: true,
      challengeToken,
      expiresAt: new Date(expiresAt).toISOString(),
      user: publicUser(auth.username),
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
    const sessionToken = randomToken();
    const csrfToken = randomToken();
    const expiresAt = Date.now() + auth.sessionTtlMs;
    sessions.set(sessionToken, {
      username: challenge.username,
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
    return { token, value: session };
  }

  function requireSession(req, res, next) {
    const current = getSession(req);
    if (!current) {
      return res.status(401).json({ error: "Sessiya tugagan. Qayta kiring." });
    }
    if (!isSafeMethod(req.method) && !safeTextEqual(String(req.get("x-csrf-token") || ""), current.value.csrfToken)) {
      return res.status(403).json({ error: "Xavfsizlik tokeni noto'g'ri. Sahifani yangilang." });
    }
    req.auth = {
      token: current.token,
      user: publicUser(current.value.username),
      csrfToken: current.value.csrfToken,
    };
    return next();
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
    return {
      user: publicUser(session.username),
      csrfToken: session.csrfToken,
      expiresAt: new Date(session.expiresAt).toISOString(),
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

  return {
    startLogin,
    completeLogin,
    getSession,
    requireSession,
    destroySession,
    sessionCookie,
    clearCookie,
    sessionPayload,
  };
}

function publicUser(username) {
  return {
    username,
    displayName: "Legal Administrator",
    role: "admin",
    initials: "LA",
  };
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
  return "";
}

function hashPassword(value, salt) {
  return crypto.scryptSync(value, salt, 64);
}

function randomToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function safeBufferEqual(left, right) {
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function safeTextEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  const size = Math.max(leftBuffer.length, rightBuffer.length, 1);
  const paddedLeft = Buffer.alloc(size);
  const paddedRight = Buffer.alloc(size);
  leftBuffer.copy(paddedLeft);
  rightBuffer.copy(paddedRight);
  return crypto.timingSafeEqual(paddedLeft, paddedRight) && leftBuffer.length === rightBuffer.length;
}

function isSafeMethod(method) {
  return method === "GET" || method === "HEAD" || method === "OPTIONS";
}
