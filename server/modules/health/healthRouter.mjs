import { Router } from "express";
import { getLegalKnowledgeStats } from "../knowledge/legalKnowledgeBase.mjs";

export function createHealthRouter({ config, legalService }) {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.json({
      ok: true,
      vertex: {
        project: config.project || null,
        location: config.location,
        models: config.modelCandidates,
        activeModel: legalService.getActiveModelName(),
      },
      pdfOnly: true,
      languages: ["uz", "ru", "en"],
      knowledge: getLegalKnowledgeStats(),
    });
  });

  return router;
}
