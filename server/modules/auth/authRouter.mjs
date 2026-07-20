import { Router } from "express";

export function createAuthRouter({ authController }) {
  const router = Router();
  router.post("/login", authController.login);
  router.post("/verify", authController.verify);
  router.get("/session", authController.session);
  router.post("/logout", authController.logout);
  return router;
}
