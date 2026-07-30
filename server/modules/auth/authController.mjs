export function createAuthController({ authService }) {
  return {
    login: (req, res) => {
      const result = authService.startLogin({
        username: req.body?.username ?? req.body?.email,
        password: req.body?.password,
        ip: req.ip,
        userAgent: String(req.get("user-agent") || "unknown").slice(0, 500),
      });
      res.setHeader("Cache-Control", "no-store");
      if (result.retryAfterSeconds) res.setHeader("Retry-After", String(result.retryAfterSeconds));
      if (!result.ok) return res.status(result.status).json(result);
      return res.json(result);
    },
    register: (req, res) => {
      const result = authService.register({
        email: req.body?.email ?? req.body?.username,
        password: req.body?.password,
        fullName: req.body?.fullName ?? req.body?.full_name,
        organizationName: req.body?.organizationName ?? req.body?.organization_name,
        preferredPlan: req.body?.preferredPlan ?? req.body?.plan ?? req.body?.preferred_plan,
        ip: req.ip,
        userAgent: String(req.get("user-agent") || "unknown").slice(0, 500),
      });
      res.setHeader("Cache-Control", "no-store");
      if (!result.ok) return res.status(result.status || 400).json(result);
      return res.status(201).json(result);
    },
    verify: (req, res) => {
      const result = authService.completeLogin({
        challengeToken: req.body?.challengeToken,
        ip: req.ip,
        userAgent: String(req.get("user-agent") || "unknown").slice(0, 500),
      });
      res.setHeader("Cache-Control", "no-store");
      if (!result.ok) return res.status(result.status).json(result);
      res.setHeader("Set-Cookie", authService.sessionCookie(result.sessionToken));
      return res.json(result.session);
    },
    session: (req, res) => {
      const current = authService.getSession(req);
      res.setHeader("Cache-Control", "no-store");
      if (!current) return res.status(401).json({ error: "Sessiya topilmadi." });
      const payload = authService.sessionPayload(current.value);
      if (!payload) return res.status(401).json({ error: "Sessiya topilmadi." });
      return res.json(payload);
    },
    logout: (req, res) => {
      const current = authService.getSession(req);
      if (current && req.get("x-csrf-token") !== current.value.csrfToken) {
        return res.status(403).json({ error: "Xavfsizlik tokeni noto'g'ri." });
      }
      authService.destroySession(req);
      res.setHeader("Set-Cookie", authService.clearCookie());
      res.setHeader("Cache-Control", "no-store");
      return res.json({ ok: true });
    },
    publicPlans: (_req, res) => {
      res.setHeader("Cache-Control", "public, max-age=60");
      return res.json({ plans: authService.listPublicPlans(), trialDays: 3 });
    },
  };
}

export function createSuperAdminController({ authService }) {
  return {
    listOrgs: (_req, res) => {
      res.setHeader("Cache-Control", "no-store");
      return res.json({ organizations: authService.store.listOrganizations() });
    },
    activate: (req, res) => {
      const result = authService.store.activateOrg(
        req.params.orgId,
        req.body?.planCode || req.body?.plan,
        Number(req.body?.days || 30),
      );
      res.setHeader("Cache-Control", "no-store");
      if (!result.ok) return res.status(result.status).json(result);
      return res.json(result);
    },
    extendTrial: (req, res) => {
      const result = authService.store.extendTrial(req.params.orgId, Number(req.body?.days || 3));
      res.setHeader("Cache-Control", "no-store");
      if (!result.ok) return res.status(result.status).json(result);
      return res.json(result);
    },
    suspend: (req, res) => {
      const result = authService.store.suspendOrg(req.params.orgId);
      res.setHeader("Cache-Control", "no-store");
      if (!result.ok) return res.status(result.status).json(result);
      return res.json(result);
    },
    costAudit: (_req, res) => {
      res.setHeader("Cache-Control", "no-store");
      return res.json(authService.getInternalCostAudit());
    },
  };
}
