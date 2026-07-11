import { normalizeAnalysis } from "./normalizeLegalAnalysis.mjs";

export function createAnalysisController({ legalService }) {
  return {
    analyzePdf: (req, res, next) => analyzePdf(req, res, next, legalService),
  };
}

async function analyzePdf(req, res, next, legalService) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "PDF fayl yuborilmadi." });
    }
    const startedAt = Date.now();
    console.log(`[api] analyze start file="${req.file.originalname}" size=${req.file.size}`);
    const result = await legalService.extractPdf(req.file);
    const normalized = normalizeAnalysis(result, req.file.originalname, startedAt, legalService.getActiveModelName());
    console.log(`[api] analyze done file="${req.file.originalname}" model=${normalized.model_used} ms=${normalized.processing_ms}`);
    return res.json(normalized);
  } catch (error) {
    console.error(`[api] analyze failed file="${req.file?.originalname || "unknown"}"`, error?.message || error);
    return next(error);
  }
}
