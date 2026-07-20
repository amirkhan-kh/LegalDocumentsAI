import fs from "node:fs";
import { GoogleGenAI } from "@google/genai";
import { PDFDocument } from "pdf-lib";
import { buildLegalRequest, buildLegalSystemInstruction } from "./legalPrompt.mjs";
import { legalAnalysisResponseSchema } from "./legalResponseSchema.mjs";
import { mergeChunkAnalyses } from "./mergeChunkAnalyses.mjs";
import { cleanupPdfChunks, splitPdfIntoPageChunks } from "./splitPdfIntoPageChunks.mjs";
import { retrieveLegalContext } from "../knowledge/legalKnowledgeBase.mjs";
import { createPdfStagingService } from "../../platform/storage/pdfStagingService.mjs";

export function createVertexLegalService(config) {
  let client = null;
  let activeModelName = null;
  let activeTransportName = null;
  let activeAnalyses = 0;
  let responseSchemaSupported = true;
  const stagingService = createPdfStagingService(config);
  const systemInstruction = buildLegalSystemInstruction();

  function getClient() {
    if (!config.project) {
      throw serviceError("Google Cloud project_id topilmadi. Credential JSON yoki GOOGLE_CLOUD_PROJECT ni tekshiring.", "VERTEX_CONFIG_ERROR", 500);
    }
    if (config.credentialPath && !fs.existsSync(config.credentialPath)) {
      throw serviceError(`Google credential JSON topilmadi: ${config.credentialPath}`, "VERTEX_CONFIG_ERROR", 500);
    }
    if (!client) {
      process.env.GOOGLE_CLOUD_PROJECT = config.project;
      process.env.GOOGLE_CLOUD_LOCATION = config.location;
      process.env.GOOGLE_GENAI_USE_ENTERPRISE = "true";
      client = new GoogleGenAI({
        vertexai: true,
        project: config.project,
        location: config.location,
      });
    }
    return client;
  }

  async function initialize() {
    getClient();
    const gcsAvailable = await stagingService.checkAvailability({ timeoutMs: 5_000 });
    return { gcsAvailable };
  }

  async function extractPdf(file, { signal, onProgress } = {}) {
    if (activeAnalyses >= config.maxConcurrentAnalyses) {
      throw serviceError("AI tahlil limiti band. 30 soniyadan keyin qayta urinib ko'ring.", "ANALYSIS_BUSY", 429);
    }

    activeAnalyses += 1;
    const startedAt = Date.now();
    const hardTimeoutMs = config.analysisHardTimeoutMs || config.analysisTimeoutMs;
    const deadline = startedAt + hardTimeoutMs;
    let chunks = [];

    try {
      throwIfAborted(signal);
      reportProgress(onProgress, {
        stage: "preparing",
        percent: 4,
        completedChunks: 0,
        totalChunks: null,
        message: "PDF strukturasi va sahifalar tekshirilmoqda",
      });

      const pageCount = await readPdfPageCount(file, signal);
      const knowledgeContext = retrieveLegalContext({
        query: `${file.originalname} contract extraction risk obligation alert payment termination renewal Uzbek Russian English`,
        limit: 4,
      });

      if (pageCount <= config.analysisDirectPageLimit) {
        reportProgress(onProgress, {
          stage: "analyzing",
          percent: 16,
          completedChunks: 0,
          totalChunks: 1,
          message: `${pageCount} sahifali PDF Gemini Pro orqali tahlil qilinmoqda`,
        });
        const directResult = await analyzePdfPart({
          file,
          deadline,
          signal,
          knowledgeContext,
        });
        directResult.__timing = {
          ...(directResult.__timing || {}),
          page_count: pageCount,
          chunk_count: 1,
          pipeline: "direct",
          total_ms: Date.now() - startedAt,
        };
        reportProgress(onProgress, {
          stage: "validating",
          percent: 96,
          completedChunks: 1,
          totalChunks: 1,
          message: "Gemini Pro javobi tekshirilmoqda",
        });
        return directResult;
      }

      reportProgress(onProgress, {
        stage: "preparing",
        percent: 9,
        completedChunks: 0,
        totalChunks: null,
        message: `${pageCount} sahifa parallel tahlil uchun bo'linmoqda`,
      });
      const splitResult = await splitPdfIntoPageChunks(file, {
        pagesPerChunk: config.analysisChunkPages,
        signal,
      });
      chunks = splitResult.chunks;
      const totalChunks = chunks.length;
      let completedChunks = 0;

      reportProgress(onProgress, {
        stage: "analyzing",
        percent: 15,
        completedChunks,
        totalChunks,
        message: `${totalChunks} bo'lak Gemini Pro orqali parallel tahlil qilinmoqda`,
      });

      const chunkResults = await mapWithConcurrency(chunks, config.analysisChunkConcurrency, async (chunk) => {
        const analysis = await analyzePdfPart({
          file: chunk.file,
          deadline,
          signal,
          knowledgeContext,
          chunk: {
            index: chunk.index,
            totalChunks,
            pageStart: chunk.pageStart,
            pageEnd: chunk.pageEnd,
          },
        });
        completedChunks += 1;
        reportProgress(onProgress, {
          stage: "analyzing",
          percent: Math.min(88, 15 + Math.round((completedChunks / totalChunks) * 73)),
          completedChunks,
          totalChunks,
          message: `${completedChunks}/${totalChunks} bo'lak tahlil qilindi`,
        });
        return {
          pageStart: chunk.pageStart,
          pageEnd: chunk.pageEnd,
          analysis,
        };
      });

      throwIfAborted(signal);
      remainingTime(deadline, hardTimeoutMs);
      reportProgress(onProgress, {
        stage: "merging",
        percent: 92,
        completedChunks,
        totalChunks,
        message: "Sahifa havolalari, maydonlar va risklar birlashtirilmoqda",
      });
      const merged = mergeChunkAnalyses(chunkResults, { fileName: file.originalname });
      merged.__timing = {
        ...(merged.__timing || {}),
        page_count: pageCount,
        chunk_count: totalChunks,
        pipeline: "parallel_chunks",
        total_ms: Date.now() - startedAt,
      };
      reportProgress(onProgress, {
        stage: "validating",
        percent: 97,
        completedChunks,
        totalChunks,
        message: "Birlashtirilgan tahlil natijasi tekshirilmoqda",
      });
      return merged;
    } finally {
      await cleanupPdfChunks(chunks);
      releaseAnalysisSlot({
        signal,
        deadline: Math.min(deadline, Date.now() + config.analysisTimeoutMs),
        release: () => { activeAnalyses = Math.max(0, activeAnalyses - 1); },
      });
    }
  }

  async function analyzePdfPart({ file, deadline, signal, knowledgeContext, chunk = null }) {
    const requestText = buildLegalRequest(file.originalname, knowledgeContext, chunk);
    const stagingStartedAt = Date.now();
    let stagedFile = null;

    try {
      try {
        stagedFile = await stagingService.stage(file, {
          timeoutMs: Math.min(30_000, remainingTime(deadline, config.analysisHardTimeoutMs)),
          signal,
        });
      } catch (error) {
        if (signal?.aborted) throw abortedError(signal);
        if (isTimeoutError(error) || Date.now() >= deadline) throw analysisTimeoutError(config.analysisHardTimeoutMs);
        if (!canUseInlineFallback(config, file)) throw gcsUnavailableError(error);
        console.warn(`[vertex] GCS staging failed, small-file inline fallback file="${file.originalname}" reason="${error?.message || error}"`);
      }

      if (!stagedFile && !canUseInlineFallback(config, file)) throw gcsUnavailableError();
      throwIfAborted(signal);

      const pdfPart = stagedFile
        ? { fileData: { fileUri: stagedFile.uri, mimeType: "application/pdf" } }
        : { inlineData: { mimeType: "application/pdf", data: (await fs.promises.readFile(file.path, { signal })).toString("base64") } };
      const transport = stagedFile?.transport || "inline";
      const stagingMs = Date.now() - stagingStartedAt;
      activeTransportName = transport;
      const errors = [];

      for (const candidateModel of config.modelCandidates) {
        for (let attempt = 1; attempt <= 3; attempt += 1) {
          const modelStartedAt = Date.now();
          const requestTimeoutMs = Math.min(
            config.analysisTimeoutMs,
            remainingTime(deadline, config.analysisHardTimeoutMs),
          );
          const timeoutSignal = AbortSignal.timeout(requestTimeoutMs);
          const requestSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
          const useResponseSchema = responseSchemaSupported;

          try {
            const result = await getClient().models.generateContent({
              model: candidateModel,
              contents: [{ role: "user", parts: [pdfPart, { text: requestText }] }],
              config: {
                systemInstruction,
                temperature: 0.1,
                topP: 0.8,
                maxOutputTokens: config.maxOutputTokens,
                responseMimeType: "application/json",
                ...(useResponseSchema ? { responseJsonSchema: legalAnalysisResponseSchema } : {}),
                thinkingConfig: isProModel(candidateModel) ? { thinkingBudget: config.proThinkingBudget } : undefined,
                httpOptions: {
                  timeout: requestTimeoutMs,
                  retryOptions: { attempts: 1 },
                },
                abortSignal: requestSignal,
              },
            });
            activeModelName = candidateModel;
            const parsed = parseJson(result.text || "");
            parsed.__model_used = candidateModel;
            parsed.__transport = transport;
            parsed.__timing = {
              staging_ms: stagingMs,
              model_ms: Date.now() - modelStartedAt,
              total_ms: Date.now() - stagingStartedAt,
            };
            return parsed;
          } catch (error) {
            if (signal?.aborted) throw abortedError(signal);
            if (useResponseSchema && isInvalidArgumentError(error)) {
              responseSchemaSupported = false;
              console.warn(`[vertex] responseJsonSchema rejected by runtime; continuing with JSON MIME validation model="${candidateModel}"`);
              continue;
            }
            if (isTimeoutError(error) || Date.now() >= deadline) {
              if (Date.now() >= deadline) throw analysisTimeoutError(config.analysisHardTimeoutMs);
              throw serviceError(
                `Gemini Pro PDF bo'lagi ${Math.round(config.analysisTimeoutMs / 1000)} soniyada yakunlanmadi.`,
                "ANALYSIS_CHUNK_TIMEOUT",
                504,
              );
            }
            if (attempt < 3 && isTransientUpstreamError(error) && remainingTime(deadline, config.analysisHardTimeoutMs) > 10_000) {
              await retryDelay(500, signal);
              continue;
            }
            if (isTransientUpstreamError(error)) {
              throw serviceError("Vertex AI vaqtinchalik upstream xato qaytardi. Qayta urinib ko'ring.", "VERTEX_UPSTREAM_ERROR", 502);
            }
            errors.push(`${candidateModel}: ${error?.message || String(error)}`);
            if (!isRecoverableModelError(error)) throw error;
            break;
          }
        }
      }

      throw serviceError(
        `Hech qaysi Gemini modeli ishlamadi. Tekshirilgan modellar: ${config.modelCandidates.join(", ")}. Oxirgi xatolar: ${errors.join(" | ")}`,
        "VERTEX_MODEL_ERROR",
        502,
      );
    } finally {
      if (stagedFile) {
        void stagedFile.cleanup().catch((error) => {
          console.warn(`[vertex] temporary GCS cleanup failed uri="${stagedFile.uri}" reason="${error?.message || error}"`);
        });
      }
    }
  }

  return {
    initialize,
    extractPdf,
    getActiveModelName: () => activeModelName,
    getActiveTransportName: () => activeTransportName,
    getRuntimeStatus: () => ({
      activeAnalyses,
      maxConcurrentAnalyses: config.maxConcurrentAnalyses,
      gcsConfigured: stagingService.bucketConfigured,
      gcsAvailable: stagingService.getAvailability(),
      inlineFallbackEnabled: config.allowInlinePdfFallback,
      directPageLimit: config.analysisDirectPageLimit,
      chunkPages: config.analysisChunkPages,
      chunkConcurrency: config.analysisChunkConcurrency,
      softTargetMs: config.analysisSoftTargetMs,
      hardTimeoutMs: config.analysisHardTimeoutMs,
      responseSchemaSupported,
    }),
  };
}

async function readPdfPageCount(file, signal) {
  try {
    const bytes = await fs.promises.readFile(file.path, { signal });
    const document = await PDFDocument.load(bytes, { updateMetadata: false });
    const pageCount = document.getPageCount();
    if (pageCount < 1) throw serviceError("PDF ichida tahlil qilinadigan sahifa topilmadi.", "INVALID_PDF", 400);
    return pageCount;
  } catch (error) {
    if (signal?.aborted) throw abortedError(signal);
    if (error?.code) throw error;
    throw serviceError("PDF ichki strukturasi o'qilmadi yoki fayl shifrlangan.", "INVALID_PDF", 400);
  }
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  let firstError = null;
  const workers = Array.from({ length: Math.min(Math.max(1, limit), items.length) }, async () => {
    while (!firstError && nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      try {
        results[index] = await worker(items[index], index);
      } catch (error) {
        firstError ||= error;
      }
    }
  });
  await Promise.allSettled(workers);
  if (firstError) throw firstError;
  return results;
}

function reportProgress(callback, progress) {
  if (typeof callback !== "function") return;
  try {
    callback(progress);
  } catch (error) {
    console.warn(`[vertex] progress callback failed reason="${error?.message || error}"`);
  }
}

function parseJson(text) {
  if (!text) throw serviceError("Vertex AI bo'sh javob qaytardi.", "VERTEX_EMPTY_RESPONSE", 502);
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (_error) {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw serviceError("Vertex AI JSON formatida javob qaytarmadi.", "VERTEX_INVALID_JSON", 502);
    try {
      parsed = JSON.parse(match[0]);
    } catch (_nestedError) {
      throw serviceError("Vertex AI to'liq JSON javob qaytarmadi.", "VERTEX_INVALID_JSON", 502);
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw serviceError("Vertex AI JSON object qaytarmadi.", "VERTEX_INVALID_JSON", 502);
  }
  return parsed;
}

function canUseInlineFallback(config, file) {
  return config.allowInlinePdfFallback && file.size <= config.inlinePdfFallbackMaxBytes;
}

function gcsUnavailableError(cause) {
  const error = serviceError("Private GCS PDF staging ishlamayapti; inline fallback xavfsizlik sabab o'chirilgan.", "VERTEX_GCS_CONFIG_ERROR", 503);
  if (cause) error.cause = cause;
  return error;
}

function remainingTime(deadline, timeoutMs = 60_000) {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw analysisTimeoutError(timeoutMs);
  return remaining;
}

function analysisTimeoutError(timeoutMs) {
  return serviceError(
    `Gemini Pro background tahlili ${Math.round(timeoutMs / 1000)} soniyalik yakuniy limitdan oshdi.`,
    "ANALYSIS_TIMEOUT",
    504,
  );
}

function abortedError(signal) {
  if (isTimeoutError(signal?.reason)) {
    return serviceError("Gemini Pro background tahlili yakuniy vaqt limitidan oshdi.", "ANALYSIS_TIMEOUT", 504);
  }
  return serviceError("PDF tahlili bekor qilindi.", "CLIENT_ABORTED", 499);
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw abortedError(signal);
}

function retryDelay(delayMs, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, delayMs);
    const abort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      reject(abortedError(signal));
    };
    if (signal?.aborted) abort();
    else signal?.addEventListener("abort", abort, { once: true });
  });
}

function releaseAnalysisSlot({ signal, deadline, release }) {
  const delayMs = signal?.aborted ? Math.max(0, deadline - Date.now()) : 0;
  if (!delayMs) {
    release();
    return;
  }
  const timer = setTimeout(release, delayMs);
  timer.unref?.();
}

function isProModel(model) {
  return /pro/i.test(model);
}

function isTimeoutError(error) {
  return /timeout|timed out|deadline|abort/i.test(String(error?.message || error))
    || error?.name === "TimeoutError"
    || error?.name === "AbortError"
    || error?.code === "GCS_STAGE_TIMEOUT";
}

function isTransientUpstreamError(error) {
  return /Bad Gateway|UNAVAILABLE|INTERNAL|temporar|\b(500|502|503|504)\b|"code"\s*:\s*(500|502|503|504)/i.test(String(error?.message || error));
}

function isRecoverableModelError(error) {
  const message = String(error?.message || error);
  return /404|NOT_FOUND|not found|does not have access|not available|INVALID_ARGUMENT/i.test(message);
}

function isInvalidArgumentError(error) {
  return /INVALID_ARGUMENT|invalid argument|\b400\b/i.test(String(error?.message || error));
}

function serviceError(message, code, status) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}
