import { apiToRun } from "./domain";
import type { AnalysisRun, ApiLegalAnalysis, KnowledgeDocument, KnowledgeStats } from "./types";
import { getCsrfToken } from "../auth/csrf";
import { MAX_PDF_BYTES } from "./constants";

export const ACTIVE_ANALYSIS_JOB_KEY = "legalai.activeAnalysisJob";

export type KnowledgeResponse = {
  document?: KnowledgeDocument;
  documents: KnowledgeDocument[];
  stats: KnowledgeStats;
};

export type AnalysisJobProgress = {
  percent: number;
  completedChunks: number;
  totalChunks: number | null;
  message: string;
};

export type AnalysisJob = {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  stage: "queued" | "preparing" | "analyzing" | "merging" | "validating" | "completed" | "failed";
  queuePosition: number;
  progress: AnalysisJobProgress;
  pollAfterMs: number;
  result?: ApiLegalAnalysis;
  error?: { code: string; message: string; retryable: boolean };
};

type AnalyzeOptions = {
  onProgress?: (job: AnalysisJob) => void;
  signal?: AbortSignal;
};

export async function analyzeLegalPdf(file: File, options: AnalyzeOptions = {}): Promise<AnalysisRun> {
  if (file.size <= 0) throw new Error("PDF fayl bo'sh.");
  if (file.size > MAX_PDF_BYTES) throw new Error("PDF fayl 50MB dan oshmasligi kerak.");
  const job = await createLegalAnalysisJob(file, options.signal);
  window.sessionStorage.setItem(ACTIVE_ANALYSIS_JOB_KEY, job.id);
  options.onProgress?.(job);
  return waitForLegalAnalysisJob(job.id, options);
}

export async function resumeLegalAnalysisJob(jobId: string, options: AnalyzeOptions = {}): Promise<AnalysisRun> {
  return waitForLegalAnalysisJob(jobId, options);
}

export function readActiveAnalysisJobId() {
  return window.sessionStorage.getItem(ACTIVE_ANALYSIS_JOB_KEY);
}

async function createLegalAnalysisJob(file: File, signal?: AbortSignal): Promise<AnalysisJob> {
  const formData = new FormData();
  formData.append("pdf", file);
  const headers = authHeaders();
  headers.set("Idempotency-Key", createIdempotencyKey());
  const response = await fetch("/api/analysis-jobs", {
    method: "POST",
    credentials: "include",
    headers,
    body: formData,
    signal,
  });
  handleUnauthorized(response);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(apiError(payload, "PDF tahlil navbatini yaratishda xatolik yuz berdi."));
  return payload as AnalysisJob;
}

async function waitForLegalAnalysisJob(jobId: string, options: AnalyzeOptions): Promise<AnalysisRun> {
  let networkFailures = 0;
  while (true) {
    if (options.signal?.aborted) throw new DOMException("Polling bekor qilindi", "AbortError");
    let response: Response;
    try {
      response = await fetch(`/api/analysis-jobs/${encodeURIComponent(jobId)}`, {
        credentials: "include",
        cache: "no-store",
        signal: options.signal,
      });
      networkFailures = 0;
    } catch (error) {
      if (options.signal?.aborted) throw error;
      networkFailures += 1;
      if (networkFailures > 8) throw error;
      await pollingDelay(Math.min(8_000, 700 * (2 ** networkFailures)), options.signal);
      continue;
    }

    handleUnauthorized(response);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(apiError(payload, "Tahlil holatini olishda xatolik yuz berdi."));
    const job = payload as AnalysisJob;
    options.onProgress?.(job);

    if (job.status === "completed" && job.result) {
      window.sessionStorage.removeItem(ACTIVE_ANALYSIS_JOB_KEY);
      return apiToRun(job.result);
    }
    if (job.status === "failed") {
      window.sessionStorage.removeItem(ACTIVE_ANALYSIS_JOB_KEY);
      throw new Error(job.error?.message || "PDF tahlili yakunlanmadi.");
    }
    await pollingDelay(Math.max(500, Math.min(5_000, Number(job.pollAfterMs) || 1_000)), options.signal);
  }
}

export async function fetchKnowledgeBase(): Promise<KnowledgeResponse> {
  const response = await fetch("/api/knowledge", { credentials: "include" });
  handleUnauthorized(response);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(apiError(payload, "Bilim bazasini olishda xatolik yuz berdi."));
  return payload as KnowledgeResponse;
}

export async function uploadKnowledgeDocument(file: File, metadata: { title: string; domain: string; language: string }): Promise<KnowledgeResponse> {
  const formData = new FormData();
  formData.append("document", file);
  formData.append("title", metadata.title);
  formData.append("domain", metadata.domain);
  formData.append("language", metadata.language);
  const response = await fetch("/api/knowledge/upload", {
    method: "POST",
    credentials: "include",
    headers: authHeaders(),
    body: formData,
  });
  handleUnauthorized(response);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(apiError(payload, "Qo'llanmani yuklashda xatolik yuz berdi."));
  return payload as KnowledgeResponse;
}

export async function deleteKnowledgeDocument(id: string): Promise<KnowledgeResponse> {
  const response = await fetch(`/api/knowledge/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
    headers: authHeaders(),
  });
  handleUnauthorized(response);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(apiError(payload, "Bilim bazasi hujjatini o'chirishda xatolik yuz berdi."));
  return payload as KnowledgeResponse;
}

export function requestErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/fetch failed|failed to fetch|networkerror/i.test(message)) {
    return "Server bilan aloqa uzildi. Background tahlil serverda davom etadi; sahifani yangilab holatni qayta tekshiring.";
  }
  return message || "PDF tahlil qilishda xatolik yuz berdi.";
}

function apiError(payload: unknown, fallback: string) {
  return typeof payload === "object" && payload && "error" in payload ? String(payload.error) : fallback;
}

function authHeaders(): Headers {
  const headers = new Headers();
  const csrfToken = getCsrfToken();
  if (csrfToken) headers.set("X-CSRF-Token", csrfToken);
  return headers;
}

function handleUnauthorized(response: Response) {
  if (response.status === 401) window.dispatchEvent(new Event("legalai:unauthorized"));
}

function createIdempotencyKey() {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function pollingDelay(delayMs: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, delayMs);
    const abort = () => {
      window.clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      reject(new DOMException("Polling bekor qilindi", "AbortError"));
    };
    if (signal?.aborted) abort();
    else signal?.addEventListener("abort", abort, { once: true });
  });
}
