import { Router } from "express";

export function createKnowledgeRouter({ upload, knowledgeController }) {
  const router = Router();

  router.get("/knowledge", knowledgeController.list);

  router.post("/knowledge/upload", (req, res, next) => {
    upload.single("document")(req, res, (error) => {
      if (error) return next(error);
      return knowledgeController.upload(req, res, next);
    });
  });

  router.delete("/knowledge/:id", knowledgeController.delete);

  return router;
}
