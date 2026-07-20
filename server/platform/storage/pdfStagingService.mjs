import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pipeline } from "node:stream/promises";
import { Storage } from "@google-cloud/storage";

const DEFAULT_CLEANUP_TIMEOUT_MS = 5_000;

export function createPdfStagingService(config) {
  const bucketName = config.pdfGcsBucket;
  const storage = bucketName ? new Storage({ projectId: config.project }) : null;
  const bucket = storage?.bucket(bucketName);
  let bucketAvailable;

  async function checkAvailability({ timeoutMs = 5_000, signal } = {}) {
    if (!bucket) {
      bucketAvailable = false;
      return false;
    }
    if (bucketAvailable !== undefined) return bucketAvailable;
    const deadline = createDeadline({ timeoutMs, signal });
    try {
      const [exists] = await abortable(bucket.exists(), deadline.signal);
      bucketAvailable = exists;
      return exists;
    } finally {
      deadline.dispose();
    }
  }

  async function stage(file, { timeoutMs = 30_000, signal } = {}) {
    const deadline = createDeadline({ timeoutMs, signal });
    let remoteFile;
    try {
      if (!await checkAvailability({ timeoutMs, signal: deadline.signal })) return null;

      const objectName = buildObjectName(file.originalname);
      remoteFile = bucket.file(objectName);
      await pipeline(
        fs.createReadStream(file.path),
        remoteFile.createWriteStream({
          resumable: file.size >= 5 * 1024 * 1024,
          validation: "crc32c",
          metadata: {
            contentType: "application/pdf",
            cacheControl: "no-store",
            metadata: {
              legalaiTemporary: "true",
              originalName: path.basename(file.originalname).slice(0, 180),
            },
          },
        }),
        { signal: deadline.signal },
      );

      return {
        uri: `gs://${bucketName}/${objectName}`,
        transport: "gcs",
        cleanup: ({ timeoutMs: cleanupTimeoutMs = DEFAULT_CLEANUP_TIMEOUT_MS } = {}) => deleteObject(remoteFile, cleanupTimeoutMs),
      };
    } catch (error) {
      if (remoteFile) void deleteObject(remoteFile, DEFAULT_CLEANUP_TIMEOUT_MS).catch(() => undefined);
      if (deadline.timedOut()) throw stagingError("PDF faylni GCS staging bucketga yuklash vaqti tugadi.", "GCS_STAGE_TIMEOUT", 504);
      throw error;
    } finally {
      deadline.dispose();
    }
  }

  return {
    stage,
    checkAvailability,
    getAvailability: () => bucketAvailable ?? null,
    bucketConfigured: Boolean(bucketName),
    bucketName,
  };
}

async function deleteObject(remoteFile, timeoutMs) {
  const deadline = createDeadline({ timeoutMs });
  try {
    await abortable(remoteFile.delete({ ignoreNotFound: true }), deadline.signal);
  } catch (error) {
    if (error?.code !== 404) throw error;
  } finally {
    deadline.dispose();
  }
}

function createDeadline({ timeoutMs, signal }) {
  const controller = new AbortController();
  let didTimeout = false;
  const safeTimeoutMs = Math.max(1, Math.floor(Number(timeoutMs) || 1));
  const timer = setTimeout(() => {
    didTimeout = true;
    controller.abort(new DOMException("Operation timed out", "TimeoutError"));
  }, safeTimeoutMs);
  timer.unref?.();

  const forwardAbort = () => controller.abort(signal.reason);
  if (signal?.aborted) forwardAbort();
  else signal?.addEventListener("abort", forwardAbort, { once: true });

  return {
    signal: controller.signal,
    timedOut: () => didTimeout,
    dispose: () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", forwardAbort);
    },
  };
}

function abortable(promise, signal) {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(signal.reason || new DOMException("Aborted", "AbortError"));
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason || new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", abort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", abort);
        reject(error);
      },
    );
  });
}

function buildObjectName(originalName) {
  const date = new Date().toISOString().slice(0, 10);
  const safeName = path.basename(originalName, path.extname(originalName)).replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "").slice(0, 80) || "document";
  return `temporary/${date}/${crypto.randomUUID()}-${safeName}.pdf`;
}

function stagingError(message, code, status) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}
