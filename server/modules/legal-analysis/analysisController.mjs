import { normalizeAnalysis } from "./normalizeLegalAnalysis.mjs";
import { removeUploadedPdf, validatePdfFile } from "./pdfFileValidation.mjs";
import { preparePdfForAnalysis } from "./preparePdfForAnalysis.mjs";

export function createAnalysisController({ legalService, jobService, maxPdfBytes }) {
  return {
    analyzePdf: (req, res, next) => analyzePdf(req, res, next, legalService, maxPdfBytes),
    createJob: (req, res, next) => createJob(req, res, next, jobService, maxPdfBytes),
    getJob: (req, res) => getJob(req, res, jobService),
  };
}

async function createJob(req, res, next, jobService, maxPdfBytes) {
  let handedOff = false;
  try {
    if (!req.file) return res.status(400).json({ error: "PDF fayl yuborilmadi." });
    await validatePdfFile(req.file, maxPdfBytes);
    const { job, reused } = jobService.enqueue({
      file: req.file,
      ownerToken: req.auth?.token,
      idempotencyKey: req.get("idempotency-key"),
    });
    handedOff = !reused;
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Location", `/api/analysis-jobs/${job.id}`);
    res.setHeader("Retry-After", String(Math.max(1, Math.ceil(job.pollAfterMs / 1000))));
    return res.status(reused ? 200 : 202).json(job);
  } catch (error) {
    return next(error);
  } finally {
    if (!handedOff) {
      await removeUploadedPdf(req.file).catch((error) => console.warn(`[api] rejected PDF cleanup failed file="${req.file?.path || "unknown"}" reason="${error?.message || error}"`));
    }
  }
}

function getJob(req, res, jobService) {
  const job = jobService.get(req.params.id, req.auth?.token);
  res.setHeader("Cache-Control", "no-store");
  if (!job) return res.status(404).json({ error: "Tahlil ishi topilmadi yoki sessiyaga tegishli emas." });
  if (job.status === "queued" || job.status === "running") {
    res.setHeader("Retry-After", String(Math.max(1, Math.ceil(job.pollAfterMs / 1000))));
  }
  return res.json(job);
}

async function analyzePdf(req, res, next, legalService, maxPdfBytes) {
  const abortController = new AbortController();
  let analysisFile = null;
  const abortRequest = () => abortController.abort();
  req.once("aborted", abortRequest);
  res.once("close", () => {
    if (!res.writableEnded) abortRequest();
  });
  try {
    if (!req.file) {
      return res.status(400).json({ error: "PDF fayl yuborilmadi." });
    }
    await validatePdfFile(req.file, maxPdfBytes);
    const preparedPdf = await preparePdfForAnalysis(req.file);
    analysisFile = preparedPdf.file;
    const startedAt = Date.now();
    console.log(`[api] analyze start file="${req.file.originalname}" upload_size=${preparedPdf.uploadedBytes} analysis_size=${preparedPdf.analysisBytes} repacked=${preparedPdf.repacked}`);
    const result = await legalService.extractPdf(analysisFile, { signal: abortController.signal });
    const normalized = normalizeAnalysis(result, req.file.originalname, startedAt, legalService.getActiveModelName());
    console.log(`[api] analyze done file="${req.file.originalname}" model=${normalized.model_used} transport=${result.__transport || "unknown"} ms=${normalized.processing_ms}`);
    return res.json(normalized);
  } catch (error) {
    console.error(`[api] analyze failed file="${req.file?.originalname || "unknown"}"`, error?.message || error);
    if (req.aborted || res.destroyed) return undefined;
    return next(error);
  } finally {
    req.off("aborted", abortRequest);
    if (analysisFile?.path && analysisFile.path !== req.file?.path) {
      await removeUploadedPdf(analysisFile).catch((error) => console.warn(`[api] prepared PDF cleanup failed file="${analysisFile.path}" reason="${error?.message || error}"`));
    }
    await removeUploadedPdf(req.file).catch((error) => console.warn(`[api] temporary PDF cleanup failed file="${req.file?.path || "unknown"}" reason="${error?.message || error}"`));
  }
}
