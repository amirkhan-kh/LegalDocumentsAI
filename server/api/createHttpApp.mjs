import express from "express";
import path from "node:path";
import { createKnowledgeUpload } from "./middleware/knowledgeUpload.mjs";
import { createPdfUpload } from "./middleware/pdfUpload.mjs";
import { createErrorHandler } from "./middleware/errorHandler.mjs";
import { createSecurityHeaders } from "./middleware/securityHeaders.mjs";
import { createAuthController, createSuperAdminController } from "../modules/auth/authController.mjs";
import { createAuthRouter, createSuperAdminRouter } from "../modules/auth/authRouter.mjs";
import { createAuthService } from "../modules/auth/authService.mjs";
import { createHealthRouter } from "../modules/health/healthRouter.mjs";
import { createAnalysisController } from "../modules/legal-analysis/analysisController.mjs";
import { createAnalysisJobService } from "../modules/legal-analysis/analysisJobService.mjs";
import { createAnalysisRouter } from "../modules/legal-analysis/analysisRouter.mjs";
import { createVertexLegalService } from "../modules/legal-analysis/vertexLegalService.mjs";
import { createKnowledgeController } from "../modules/knowledge/knowledgeController.mjs";
import { createKnowledgeRouter } from "../modules/knowledge/knowledgeRouter.mjs";
import { createKnowledgeService } from "../modules/knowledge/knowledgeService.mjs";

export async function createHttpApp({ config, rootDir }) {
  const app = express();
  const legalService = createVertexLegalService(config);
  await legalService.initialize().catch((error) => {
    console.warn(`[vertex] startup infrastructure check failed reason="${error?.message || error}"`);
  });
  const knowledgeService = createKnowledgeService(config);
  const authService = createAuthService({ ...config, rootDir });
  const authController = createAuthController({ authService });
  const superAdminController = createSuperAdminController({ authService });
  const analysisJobService = createAnalysisJobService({ legalService, config });
  const analysisController = createAnalysisController({
    legalService,
    jobService: analysisJobService,
    maxPdfBytes: config.maxPdfBytes,
    authService,
  });
  const knowledgeController = createKnowledgeController({ knowledgeService });
  const upload = createPdfUpload(config.maxPdfBytes);
  const knowledgeUpload = createKnowledgeUpload(config.maxKnowledgeBytes);

  app.disable("x-powered-by");
  app.use(createSecurityHeaders({ isProduction: config.isProduction }));
  app.use(express.json({ limit: "1mb" }));
  app.use("/api/auth", createAuthRouter({ authController }));
  app.use("/api", createHealthRouter({ config, legalService, analysisJobService }));
  app.use("/api/super-admin", createSuperAdminRouter({
    superAdminController,
    requireSuperAdmin: authService.requireSuperAdmin.bind(authService),
  }));
  app.use("/api", authService.requireSession);
  app.use("/api", createKnowledgeRouter({ upload: knowledgeUpload, knowledgeController }));
  app.use("/api", createAnalysisRouter({ upload, analysisController }));
  app.use(createErrorHandler({ isProduction: config.isProduction }));

  if (config.isProduction) {
    app.use(express.static(path.join(rootDir, "dist")));
    app.get(/.*/, (_req, res) => {
      res.sendFile(path.join(rootDir, "dist", "index.html"));
    });
  } else {
    const { createServer } = await import("vite");
    const vite = await createServer({
      server: { middlewareMode: true, host: "0.0.0.0" },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  return app;
}
