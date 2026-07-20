import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ADC_CREDENTIAL_PATH = path.join(os.homedir(), ".config", "gcloud", "application_default_credentials.json");
const DEFAULT_MODELS = "gemini-2.5-pro";
const MAX_PDF_BYTES = 50 * 1024 * 1024;

export function createRuntimeConfig() {
  const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || (fs.existsSync(ADC_CREDENTIAL_PATH) ? ADC_CREDENTIAL_PATH : "");
  const project = readProjectId(credentialPath);
  const defaultPdfBucket = project ? `${project}-legalai-pdf` : "";

  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && credentialPath) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialPath;
  }

  return {
    isProduction: process.env.NODE_ENV === "production",
    port: readNumber("PORT", 5174, { min: 1, max: 65_535 }),
    credentialPath,
    project,
    location: process.env.VERTEX_LOCATION || process.env.GOOGLE_CLOUD_LOCATION || "global",
    modelCandidates: (process.env.VERTEX_MODEL || process.env.VERTEX_MODELS || DEFAULT_MODELS)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    maxPdfBytes: readNumber("MAX_PDF_BYTES", MAX_PDF_BYTES, { min: 1, max: MAX_PDF_BYTES }),
    maxKnowledgeBytes: readNumber("MAX_KNOWLEDGE_BYTES", 25 * 1024 * 1024, { min: 1, max: 50 * 1024 * 1024 }),
    maxOutputTokens: readNumber("VERTEX_MAX_OUTPUT_TOKENS", 8_192, { min: 1_024, max: 8_192 }),
    analysisTimeoutMs: readNumber("VERTEX_ANALYSIS_TIMEOUT_MS", 90_000, { min: 10_000, max: 120_000 }),
    analysisHardTimeoutMs: readNumber("VERTEX_ANALYSIS_HARD_TIMEOUT_MS", 4 * 60_000, { min: 60_000, max: 10 * 60_000 }),
    analysisSoftTargetMs: readNumber("VERTEX_ANALYSIS_SOFT_TARGET_MS", 60_000, { min: 20_000, max: 120_000 }),
    analysisDirectPageLimit: readNumber("VERTEX_DIRECT_PAGE_LIMIT", 20, { min: 1, max: 100 }),
    analysisChunkPages: readNumber("VERTEX_CHUNK_PAGES", 13, { min: 2, max: 50 }),
    analysisChunkConcurrency: readNumber("VERTEX_CHUNK_CONCURRENCY", 4, { min: 1, max: 8 }),
    analysisJobTtlMs: readNumber("LEGALAI_ANALYSIS_JOB_TTL_MS", 15 * 60_000, { min: 60_000, max: 60 * 60_000 }),
    maxQueuedAnalysisJobs: readNumber("LEGALAI_MAX_QUEUED_ANALYSIS_JOBS", 5, { min: 1, max: 25 }),
    maxSessionAnalysisJobs: readNumber("LEGALAI_MAX_SESSION_ANALYSIS_JOBS", 2, { min: 1, max: 10 }),
    proThinkingBudget: readNumber("VERTEX_PRO_THINKING_BUDGET", 128, { min: 128, max: 8_192 }),
    maxConcurrentAnalyses: readNumber("VERTEX_MAX_CONCURRENT_ANALYSES", 2, { min: 1, max: 10 }),
    pdfGcsBucket: process.env.VERTEX_PDF_GCS_BUCKET ?? defaultPdfBucket,
    allowInlinePdfFallback: process.env.VERTEX_ALLOW_INLINE_PDF_FALLBACK === "true",
    inlinePdfFallbackMaxBytes: readNumber("VERTEX_INLINE_PDF_FALLBACK_MAX_BYTES", 5 * 1024 * 1024, { min: 1, max: 5 * 1024 * 1024 }),
    auth: {
      username: process.env.LEGALAI_ADMIN_USER || "admin",
      password: process.env.LEGALAI_ADMIN_PASSWORD || "legal123",
      sessionTtlMs: readNumber("LEGALAI_SESSION_TTL_MS", 8 * 60 * 60 * 1000, { min: 60_000, max: 24 * 60 * 60 * 1000 }),
      challengeTtlMs: readNumber("LEGALAI_AUTH_CHALLENGE_TTL_MS", 5 * 60 * 1000, { min: 30_000, max: 15 * 60 * 1000 }),
      maxAttempts: readNumber("LEGALAI_AUTH_MAX_ATTEMPTS", 5, { min: 1, max: 20 }),
      attemptWindowMs: readNumber("LEGALAI_AUTH_ATTEMPT_WINDOW_MS", 10 * 60 * 1000, { min: 60_000, max: 60 * 60 * 1000 }),
      lockoutMs: readNumber("LEGALAI_AUTH_LOCKOUT_MS", 15 * 60 * 1000, { min: 60_000, max: 24 * 60 * 60 * 1000 }),
      cookieName: process.env.LEGALAI_SESSION_COOKIE || "legalai_session",
    },
  };
}

function readNumber(name, fallback, { min, max }) {
  const raw = process.env[name];
  const value = raw === undefined || raw === "" ? fallback : Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.round(Math.max(min, Math.min(max, value)));
}

function readProjectId(credentialPath) {
  try {
    const raw = fs.readFileSync(credentialPath, "utf8");
    const parsed = JSON.parse(raw);
    return process.env.GOOGLE_CLOUD_PROJECT || parsed.project_id || parsed.quota_project_id;
  } catch (_error) {
    return process.env.GOOGLE_CLOUD_PROJECT;
  }
}
