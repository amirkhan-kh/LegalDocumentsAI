import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getPlanByCode, TRIAL_ANALYSIS_LIMIT, TRIAL_DAYS } from "./plans.mjs";

/**
 * Lightweight JSON-file SaaS store (users, orgs, usage).
 * Sufficient for multi-tenant SaaS MVP without Postgres.
 */
export function createSaasStore({ dataDir, adminUsername, adminPassword }) {
  const storePath = path.join(dataDir, "saas-store.json");
  /** @type {import("./storeTypes.js").SaasState | null} */
  let state = null;
  let writeTimer = null;

  function ensureLoaded() {
    if (state) return state;
    fs.mkdirSync(dataDir, { recursive: true });
    if (fs.existsSync(storePath)) {
      try {
        state = JSON.parse(fs.readFileSync(storePath, "utf8"));
      } catch {
        state = emptyState();
      }
    } else {
      state = emptyState();
    }
    seedSuperAdmin(state, adminUsername, adminPassword);
    persistSync();
    return state;
  }

  function emptyState() {
    return {
      version: 1,
      users: [],
      organizations: [],
      memberships: [],
      usage: [],
    };
  }

  function persistSync() {
    if (!state) return;
    const tmp = `${storePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2), "utf8");
    fs.renameSync(tmp, storePath);
  }

  function schedulePersist() {
    if (writeTimer) return;
    writeTimer = setTimeout(() => {
      writeTimer = null;
      try {
        persistSync();
      } catch (error) {
        console.error("[saas] persist failed", error?.message || error);
      }
    }, 80);
    writeTimer.unref?.();
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function newId() {
    return crypto.randomUUID();
  }

  function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
    const derived = crypto.scryptSync(String(password), salt, 64).toString("hex");
    return `${salt}:${derived}`;
  }

  function verifyPassword(password, stored) {
    const [salt, expected] = String(stored || "").split(":");
    if (!salt || !expected) return false;
    const actual = crypto.scryptSync(String(password), salt, 64);
    const expectedBuf = Buffer.from(expected, "hex");
    if (actual.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(actual, expectedBuf);
  }

  function seedSuperAdmin(current, username, password) {
    const login = String(username || "admin").trim().toLowerCase();
    let user = current.users.find((u) => u.username === login || u.email === login);
    if (!user) {
      user = {
        id: newId(),
        username: login,
        email: login.includes("@") ? login : `${login}@legalai.local`,
        passwordHash: hashPassword(password || "legal123"),
        fullName: "Legal Super Admin",
        isSuperAdmin: true,
        status: "active",
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      current.users.push(user);
    } else {
      user.isSuperAdmin = true;
      user.status = "active";
      user.passwordHash = hashPassword(password || "legal123");
      user.updatedAt = nowIso();
    }
  }

  function slugify(name) {
    const base = String(name || "org")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "org";
    let candidate = base;
    let n = 0;
    const s = ensureLoaded();
    while (s.organizations.some((o) => o.slug === candidate)) {
      n += 1;
      candidate = `${base}-${n}`;
    }
    return candidate;
  }

  function publicUser(user, org = null, membership = null) {
    const role = user.isSuperAdmin
      ? "super_admin"
      : membership?.role || (org ? "owner" : "member");
    const displayName = user.fullName || user.username;
    const initials = displayName
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0] || "")
      .join("")
      .toUpperCase() || "LA";
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName,
      role,
      isSuperAdmin: Boolean(user.isSuperAdmin),
      initials,
      organizationId: org?.id || null,
      organizationName: org?.name || null,
      organizationStatus: org?.status || null,
    };
  }

  function findUserByLogin(login) {
    const key = String(login || "").trim().toLowerCase();
    const s = ensureLoaded();
    return s.users.find((u) => u.username === key || u.email === key) || null;
  }

  function getUserById(id) {
    return ensureLoaded().users.find((u) => u.id === id) || null;
  }

  function getOrgById(id) {
    return ensureLoaded().organizations.find((o) => o.id === id) || null;
  }

  function getMembership(userId, orgId) {
    return (
      ensureLoaded().memberships.find((m) => m.userId === userId && m.organizationId === orgId) || null
    );
  }

  function primaryOrgForUser(user) {
    if (!user || user.isSuperAdmin) return null;
    const s = ensureLoaded();
    const membership = s.memberships.find((m) => m.userId === user.id);
    if (!membership) return null;
    return s.organizations.find((o) => o.id === membership.organizationId) || null;
  }

  function authenticate(login, password) {
    const user = findUserByLogin(login);
    if (!user || user.status === "disabled") return null;
    if (!verifyPassword(password, user.passwordHash)) return null;
    user.lastLoginAt = nowIso();
    user.updatedAt = nowIso();
    schedulePersist();
    const org = primaryOrgForUser(user);
    const membership = org ? getMembership(user.id, org.id) : null;
    return { user, org, membership };
  }

  function register({ email, password, fullName, organizationName, preferredPlan }) {
    const s = ensureLoaded();
    const login = String(email || "").trim().toLowerCase();
    // Login yoki email — "@" majburiy emas
    if (!login || login.length < 2) {
      return { ok: false, status: 400, error: "Login yoki email kiriting." };
    }
    if (/\s/.test(login)) {
      return { ok: false, status: 400, error: "Login bo'shliqsiz bo'lishi kerak." };
    }
    if (!password || String(password).length < 8) {
      return { ok: false, status: 400, error: "Parol kamida 8 ta belgi bo'lishi kerak." };
    }
    const orgName = String(organizationName || "").trim();
    if (!orgName) {
      return { ok: false, status: 400, error: "Tashkilot nomini kiriting." };
    }
    if (findUserByLogin(login)) {
      return { ok: false, status: 409, error: "Bu login allaqachon ro'yxatdan o'tgan." };
    }

    const plan = getPlanByCode(preferredPlan) || getPlanByCode("growth");
    const trialEnds = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const localPart = login.includes("@") ? login.split("@")[0] : login;
    const user = {
      id: newId(),
      username: login,
      email: login.includes("@") ? login : `${login}@legalai.local`,
      passwordHash: hashPassword(password),
      fullName: String(fullName || "").trim() || localPart,
      isSuperAdmin: false,
      status: "active",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    const org = {
      id: newId(),
      name: orgName,
      slug: slugify(orgName),
      ownerUserId: user.id,
      status: "trial",
      trialEndsAt: trialEnds,
      trialAnalysisLimit: TRIAL_ANALYSIS_LIMIT,
      planCode: plan?.code || "growth",
      preferredPlanCode: plan?.code || "growth",
      notes: "",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    const membership = {
      id: newId(),
      organizationId: org.id,
      userId: user.id,
      role: "owner",
      createdAt: nowIso(),
    };
    s.users.push(user);
    s.organizations.push(org);
    s.memberships.push(membership);
    schedulePersist();
    return { ok: true, user, org, membership };
  }

  function yearMonth(date = new Date()) {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  function getOrCreateUsage(orgId) {
    const s = ensureLoaded();
    const ym = yearMonth();
    let row = s.usage.find((u) => u.organizationId === orgId && u.yearMonth === ym);
    if (!row) {
      row = {
        organizationId: orgId,
        yearMonth: ym,
        analyses: 0,
        updatedAt: nowIso(),
      };
      s.usage.push(row);
      schedulePersist();
    }
    return row;
  }

  function orgAccessAllowed(org) {
    if (!org) return { ok: false, reason: "organization_missing" };
    if (org.status === "suspended") return { ok: false, reason: "org_suspended" };
    if (org.status === "trial" && org.trialEndsAt) {
      if (new Date(org.trialEndsAt).getTime() < Date.now()) {
        return { ok: false, reason: "trial_expired" };
      }
    }
    if (!["trial", "active"].includes(org.status)) {
      return { ok: false, reason: "org_inactive" };
    }
    return { ok: true, reason: "ok" };
  }

  function effectiveAnalysisLimit(org) {
    if (!org) return 0;
    if (org.status === "trial") return Number(org.trialAnalysisLimit || TRIAL_ANALYSIS_LIMIT);
    const plan = getPlanByCode(org.planCode);
    return plan?.analysesMonthly || TRIAL_ANALYSIS_LIMIT;
  }

  function canAnalyze(org) {
    const access = orgAccessAllowed(org);
    if (!access.ok) return { ok: false, reason: access.reason };
    const limit = effectiveAnalysisLimit(org);
    const used = getOrCreateUsage(org.id).analyses;
    if (used >= limit) return { ok: false, reason: "analysis_quota_exceeded", used, limit };
    return { ok: true, reason: "ok", used, limit };
  }

  function incrementAnalysis(orgId, count = 1) {
    if (!orgId) return null;
    const row = getOrCreateUsage(orgId);
    row.analyses = Number(row.analyses || 0) + count;
    row.updatedAt = nowIso();
    schedulePersist();
    return row;
  }

  function listOrganizations() {
    const s = ensureLoaded();
    return s.organizations
      .slice()
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .map((org) => enrichOrg(org));
  }

  function enrichOrg(org) {
    if (!org) return null;
    const plan = getPlanByCode(org.planCode);
    const usage = getOrCreateUsage(org.id);
    const limit = effectiveAnalysisLimit(org);
    const owner = getUserById(org.ownerUserId);
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      status: org.status,
      trialEndsAt: org.trialEndsAt,
      planCode: org.planCode,
      preferredPlanCode: org.preferredPlanCode,
      plan: plan
        ? { code: plan.code, name: plan.name, priceUsd: plan.priceUsd, analysesMonthly: plan.analysesMonthly }
        : null,
      usage: { yearMonth: usage.yearMonth, analyses: usage.analyses, limit },
      owner: owner
        ? { id: owner.id, email: owner.email, fullName: owner.fullName || owner.username }
        : null,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
      notes: org.notes || "",
    };
  }

  function activateOrg(orgId, planCode, days = 30) {
    const org = getOrgById(orgId);
    if (!org) return { ok: false, status: 404, error: "Tashkilot topilmadi." };
    const plan = getPlanByCode(planCode) || getPlanByCode(org.preferredPlanCode) || getPlanByCode("growth");
    org.status = "active";
    org.planCode = plan.code;
    org.trialEndsAt = null;
    org.updatedAt = nowIso();
    org.notes = `${org.notes || ""}\nActivated ${plan.code} for ${days}d @ ${nowIso()}`.trim();
    schedulePersist();
    return { ok: true, org: enrichOrg(org) };
  }

  function extendTrial(orgId, days = TRIAL_DAYS) {
    const org = getOrgById(orgId);
    if (!org) return { ok: false, status: 404, error: "Tashkilot topilmadi." };
    const base = org.trialEndsAt && new Date(org.trialEndsAt).getTime() > Date.now()
      ? new Date(org.trialEndsAt)
      : new Date();
    base.setUTCDate(base.getUTCDate() + Number(days || TRIAL_DAYS));
    org.status = "trial";
    org.trialEndsAt = base.toISOString();
    org.updatedAt = nowIso();
    schedulePersist();
    return { ok: true, org: enrichOrg(org) };
  }

  function suspendOrg(orgId) {
    const org = getOrgById(orgId);
    if (!org) return { ok: false, status: 404, error: "Tashkilot topilmadi." };
    org.status = "suspended";
    org.updatedAt = nowIso();
    schedulePersist();
    return { ok: true, org: enrichOrg(org) };
  }

  function orgSummaryForSession(org) {
    if (!org) return null;
    const enriched = enrichOrg(org);
    return {
      id: enriched.id,
      name: enriched.name,
      status: enriched.status,
      trialEndsAt: enriched.trialEndsAt,
      planCode: enriched.planCode,
      plan: enriched.plan,
      usage: enriched.usage,
    };
  }

  return {
    ensureLoaded,
    authenticate,
    register,
    publicUser,
    getUserById,
    getOrgById,
    primaryOrgForUser,
    getMembership,
    canAnalyze,
    incrementAnalysis,
    listOrganizations,
    activateOrg,
    extendTrial,
    suspendOrg,
    orgSummaryForSession,
    orgAccessAllowed,
    effectiveAnalysisLimit,
  };
}
