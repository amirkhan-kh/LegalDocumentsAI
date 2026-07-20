import { Router } from "express";
import { getLegalKnowledgeStats } from "../knowledge/legalKnowledgeBase.mjs";

export function createHealthRouter({ config, legalService, analysisJobService }) {
  const router = Router();

  router.get("/health", (_req, res) => {
    const runtime = legalService.getRuntimeStatus();
    const vertexReady = Boolean(config.project && config.modelCandidates.length && (runtime.gcsAvailable || config.allowInlinePdfFallback));
    res.json({
      ok: true,
      ready: vertexReady,
      vertex: {
        configured: vertexReady,
        location: config.location,
        models: config.modelCandidates,
        activeModel: legalService.getActiveModelName(),
        activeTransport: legalService.getActiveTransportName(),
        requestTimeoutSeconds: Math.round(config.analysisTimeoutMs / 1000),
        softTargetSeconds: Math.round(config.analysisSoftTargetMs / 1000),
        hardTimeoutSeconds: Math.round(config.analysisHardTimeoutMs / 1000),
        proThinkingBudget: config.proThinkingBudget,
        runtime,
      },
      pdfOnly: true,
      maxPdfBytes: config.maxPdfBytes,
      authRequired: true,
      languages: ["uz", "ru", "en"],
      knowledge: getLegalKnowledgeStats(),
      analysisJobs: analysisJobService?.runtimeStatus() || null,
    });
  });

  return router;
}
