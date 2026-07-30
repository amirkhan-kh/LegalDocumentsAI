import { Router } from "express";

export function createAuthRouter({ authController }) {
  const router = Router();
  router.post("/login", authController.login);
  router.post("/register", authController.register);
  router.post("/verify", authController.verify);
  router.get("/session", authController.session);
  router.post("/logout", authController.logout);
  router.get("/plans", authController.publicPlans);
  return router;
}

export function createSuperAdminRouter({ superAdminController, requireSuperAdmin }) {
  const router = Router();
  router.use(requireSuperAdmin);
  router.get("/organizations", superAdminController.listOrgs);
  router.post("/organizations/:orgId/activate", superAdminController.activate);
  router.post("/organizations/:orgId/extend-trial", superAdminController.extendTrial);
  router.post("/organizations/:orgId/suspend", superAdminController.suspend);
  router.get("/cost-audit", superAdminController.costAudit);
  return router;
}
