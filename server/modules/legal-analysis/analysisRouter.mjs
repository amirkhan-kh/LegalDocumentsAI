import { Router } from "express";

export function createAnalysisRouter({ upload, analysisController }) {
  const router = Router();

  router.post("/analyze-pdf", (req, res, next) => {
    upload.single("pdf")(req, res, (error) => {
      if (error) return next(error);
      return analysisController.analyzePdf(req, res, next);
    });
  });

  router.post("/analysis-jobs", (req, res, next) => {
    upload.single("pdf")(req, res, (error) => {
      if (error) return next(error);
      return analysisController.createJob(req, res, next);
    });
  });

  router.get("/analysis-jobs/:id", analysisController.getJob);

  return router;
}
