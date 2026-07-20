export function createAuthController({ authService }) {
  return {
    login: (req, res) => {
      const result = authService.startLogin({
        username: req.body?.username,
        password: req.body?.password,
        ip: req.ip,
        userAgent: String(req.get("user-agent") || "unknown").slice(0, 500),
      });
      res.setHeader("Cache-Control", "no-store");
      if (result.retryAfterSeconds) res.setHeader("Retry-After", String(result.retryAfterSeconds));
      if (!result.ok) return res.status(result.status).json(result);
      return res.json(result);
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
      return res.json(authService.sessionPayload(current.value));
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
  };
}
