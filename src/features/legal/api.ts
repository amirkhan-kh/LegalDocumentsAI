import { apiToRun } from "./domain";
import type { AnalysisRun, ApiLegalAnalysis, KnowledgeDocument, KnowledgeStats } from "./types";

export type KnowledgeResponse = {
  document?: KnowledgeDocument;
  documents: KnowledgeDocument[];
  stats: KnowledgeStats;
};

export async function analyzeLegalPdf(file: File): Promise<AnalysisRun> {
  const formData = new FormData();
  formData.append("pdf", file);
  const response = await fetch("/api/analyze-pdf", {
    method: "POST",
    body: formData,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof payload === "object" && payload && "error" in payload ? String(payload.error) : "PDF tahlil qilishda xatolik yuz berdi.");
  }
  return apiToRun(payload as ApiLegalAnalysis);
}

export async function fetchKnowledgeBase(): Promise<KnowledgeResponse> {
  const response = await fetch("/api/knowledge");
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(apiError(payload, "Bilim bazasini olishda xatolik yuz berdi."));
  }
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
    body: formData,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(apiError(payload, "Qo'llanmani yuklashda xatolik yuz berdi."));
  }
  return payload as KnowledgeResponse;
}

export async function deleteKnowledgeDocument(id: string): Promise<KnowledgeResponse> {
  const response = await fetch(`/api/knowledge/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(apiError(payload, "Bilim bazasi hujjatini o'chirishda xatolik yuz berdi."));
  }
  return payload as KnowledgeResponse;
}

export function requestErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/fetch failed|failed to fetch|networkerror/i.test(message)) {
    return "Server bilan aloqa uzildi. Dev server ishlayotganini tekshiring, sahifani refresh qilmasdan PDF tahlilni qayta boshlang.";
  }
  return message || "PDF tahlil qilishda xatolik yuz berdi.";
}

function apiError(payload: unknown, fallback: string) {
  return typeof payload === "object" && payload && "error" in payload ? String(payload.error) : fallback;
}
