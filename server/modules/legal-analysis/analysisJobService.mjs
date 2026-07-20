import crypto from "node:crypto";
import { normalizeAnalysis } from "./normalizeLegalAnalysis.mjs";
import { preparePdfForAnalysis } from "./preparePdfForAnalysis.mjs";
import { removeUploadedPdf } from "./pdfFileValidation.mjs";
import { toPublicError } from "../../api/middleware/errorHandler.mjs";

const ACTIVE_STATUSES = new Set(["queued", "running"]);

export function createAnalysisJobService({ legalService, config }) {
  const jobs = new Map();
  const idempotencyIndex = new Map();
  const queue = [];
  let activeWorkers = 0;
  const maxWorkers = 1;
  const cleanupTimer = setInterval(cleanupExpiredJobs, 60_000);
  cleanupTimer.unref?.();

  function enqueue({ file, ownerToken, idempotencyKey = "" }) {
    cleanupExpiredJobs();
    const ownerHash = hashOwner(ownerToken);
    const safeIdempotencyKey = String(idempotencyKey || "").trim().slice(0, 160);
    const indexKey = safeIdempotencyKey ? `${ownerHash}:${safeIdempotencyKey}` : "";
    const existingId = indexKey ? idempotencyIndex.get(indexKey) : "";
    const existing = existingId ? jobs.get(existingId) : null;
    if (existing) return { job: publicJob(existing), reused: true };

    const activeForOwner = [...jobs.values()].filter((job) => job.ownerHash === ownerHash && ACTIVE_STATUSES.has(job.status)).length;
    if (activeForOwner >= config.maxSessionAnalysisJobs) {
      throw jobError(`Bu sessiyada bir vaqtning o'zida ko'pi bilan ${config.maxSessionAnalysisJobs} ta tahlil bo'lishi mumkin.`, "SESSION_JOB_LIMIT", 429);
    }
    if (queue.length >= config.maxQueuedAnalysisJobs) {
      throw jobError("AI tahlil navbati to'lgan. Birozdan keyin qayta urinib ko'ring.", "ANALYSIS_QUEUE_FULL", 429);
    }

    const now = Date.now();
    const job = {
      id: crypto.randomUUID(),
      ownerHash,
      idempotencyKey: safeIdempotencyKey,
      indexKey,
      file,
      originalName: file.originalname,
      status: "queued",
      stage: "queued",
      progress: {
        percent: 0,
        completedChunks: 0,
        totalChunks: null,
        message: "Tahlil navbatga qo'shildi",
      },
      result: null,
      error: null,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      completedAt: null,
      expiresAt: now + config.analysisJobTtlMs,
    };
    jobs.set(job.id, job);
    if (indexKey) idempotencyIndex.set(indexKey, job.id);
    queue.push(job.id);
    setImmediate(pump);
    return { job: publicJob(job), reused: false };
  }

  function get(id, ownerToken) {
    cleanupExpiredJobs();
    const job = jobs.get(String(id || ""));
    if (!job || job.ownerHash !== hashOwner(ownerToken)) return null;
    return publicJob(job);
  }

  function runtimeStatus() {
    return {
      activeWorkers,
      maxWorkers,
      queuedJobs: queue.length,
      retainedJobs: jobs.size,
    };
  }

  function pump() {
    while (activeWorkers < maxWorkers && queue.length) {
      const id = queue.shift();
      const job = jobs.get(id);
      if (!job || job.status !== "queued") continue;
      activeWorkers += 1;
      void run(job).finally(() => {
        activeWorkers = Math.max(0, activeWorkers - 1);
        setImmediate(pump);
      });
    }
  }

  async function run(job) {
    const uploadedFile = job.file;
    let analysisFile = null;
    const timeoutSignal = AbortSignal.timeout(config.analysisHardTimeoutMs);
    job.status = "running";
    job.stage = "preparing";
    job.startedAt = Date.now();
    updateProgress(job, {
      stage: "preparing",
      percent: 2,
      completedChunks: 0,
      totalChunks: null,
      message: "PDF xavfsiz tahlil uchun tayyorlanmoqda",
    });

    try {
      const preparedPdf = await preparePdfForAnalysis(job.file);
      analysisFile = preparedPdf.file;
      console.log(`[api] analysis job start id=${job.id} file="${job.originalName}" upload_size=${preparedPdf.uploadedBytes} analysis_size=${preparedPdf.analysisBytes} repacked=${preparedPdf.repacked}`);
      const result = await legalService.extractPdf(analysisFile, {
        signal: timeoutSignal,
        onProgress: (progress) => updateProgress(job, progress),
      });
      job.stage = "validating";
      updateProgress(job, {
        ...job.progress,
        stage: "validating",
        percent: 98,
        message: "Natija LegalAI reyestri uchun tekshirilmoqda",
      });
      const normalized = normalizeAnalysis(result, job.originalName, job.startedAt, legalService.getActiveModelName());
      job.result = normalized;
      job.status = "completed";
      job.stage = "completed";
      job.completedAt = Date.now();
      job.expiresAt = job.completedAt + config.analysisJobTtlMs;
      updateProgress(job, {
        ...job.progress,
        stage: "completed",
        percent: 100,
        message: "Tahlil muvaffaqiyatli yakunlandi",
      });
      console.log(`[api] analysis job done id=${job.id} file="${job.originalName}" model=${normalized.model_used} transport=${result.__transport || "unknown"} ms=${normalized.processing_ms}`);
    } catch (error) {
      job.status = "failed";
      job.stage = "failed";
      job.completedAt = Date.now();
      job.expiresAt = job.completedAt + config.analysisJobTtlMs;
      job.error = {
        code: String(error?.code || "ANALYSIS_FAILED"),
        message: toPublicError(error),
        retryable: isRetryable(error),
      };
      updateProgress(job, {
        ...job.progress,
        stage: "failed",
        message: job.error.message,
      });
      console.error(`[api] analysis job failed id=${job.id} file="${job.originalName}"`, error?.message || error);
    } finally {
      if (analysisFile?.path && analysisFile.path !== uploadedFile?.path) {
        await removeUploadedPdf(analysisFile).catch((error) => console.warn(`[api] prepared PDF cleanup failed file="${analysisFile.path}" reason="${error?.message || error}"`));
      }
      await removeUploadedPdf(uploadedFile).catch((error) => console.warn(`[api] temporary PDF cleanup failed file="${uploadedFile?.path || "unknown"}" reason="${error?.message || error}"`));
      job.file = null;
    }
  }

  function updateProgress(job, progress) {
    job.stage = progress.stage || job.stage;
    job.progress = {
      percent: clampPercent(progress.percent ?? job.progress.percent),
      completedChunks: nonNegativeInteger(progress.completedChunks, job.progress.completedChunks),
      totalChunks: nullableNonNegativeInteger(progress.totalChunks, job.progress.totalChunks),
      message: String(progress.message || job.progress.message || ""),
    };
    job.updatedAt = Date.now();
  }

  function publicJob(job) {
    const queuePosition = job.status === "queued" ? Math.max(1, queue.indexOf(job.id) + 1) : 0;
    return {
      id: job.id,
      status: job.status,
      stage: job.stage,
      queuePosition,
      progress: { ...job.progress },
      createdAt: new Date(job.createdAt).toISOString(),
      updatedAt: new Date(job.updatedAt).toISOString(),
      startedAt: job.startedAt ? new Date(job.startedAt).toISOString() : null,
      completedAt: job.completedAt ? new Date(job.completedAt).toISOString() : null,
      expiresAt: new Date(job.expiresAt).toISOString(),
      pollAfterMs: job.status === "queued" ? 1_200 : 900,
      ...(job.result ? { result: job.result } : {}),
      ...(job.error ? { error: job.error } : {}),
    };
  }

  function cleanupExpiredJobs() {
    const now = Date.now();
    for (const [id, job] of jobs) {
      if (ACTIVE_STATUSES.has(job.status) || job.expiresAt > now) continue;
      jobs.delete(id);
      if (job.indexKey && idempotencyIndex.get(job.indexKey) === id) idempotencyIndex.delete(job.indexKey);
    }
  }

  return { enqueue, get, runtimeStatus };
}

function hashOwner(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

function clampPercent(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, Math.round(number))) : 0;
}

function nonNegativeInteger(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : fallback;
}

function nullableNonNegativeInteger(value, fallback) {
  if (value === null) return null;
  return nonNegativeInteger(value, fallback);
}

function isRetryable(error) {
  return [429, 502, 503, 504].includes(Number(error?.status))
    || ["ANALYSIS_BUSY", "ANALYSIS_QUEUE_FULL", "ANALYSIS_TIMEOUT", "ANALYSIS_CHUNK_TIMEOUT", "VERTEX_UPSTREAM_ERROR"].includes(String(error?.code || ""));
}

function jobError(message, code, status) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}
