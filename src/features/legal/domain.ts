import type {
  ApiLegalAnalysis,
  AnalysisRun,
  Contract,
  ContractField,
  ContractStatus,
  Obligation,
  ObligationStatus,
  ProposalStatus,
  Risk,
  RiskLevel,
  SearchMatch,
  Task,
  TaskStatus,
} from "./types";

export const employees = ["Aziza R.", "Bekzod N.", "Dilshod K.", "Malika S.", "Samandar T."];

export function fmtDate(value: string, language = "uz") {
  if (!value) return "Muddat yo'q";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const locale = language === "ru" ? "ru-RU" : language === "en" ? "en-US" : "uz-Latn-UZ";
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

export function daysUntil(value: string) {
  if (!value) return 999999;
  const diff = new Date(value).getTime() - startOfToday().getTime();
  if (Number.isNaN(diff)) return 999999;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function riskLabel(level: RiskLevel) {
  return level === "high" ? "Yuqori" : level === "medium" ? "O'rta" : "Past";
}

export function statusLabel(status: ObligationStatus | ContractStatus | TaskStatus | ProposalStatus) {
  const labels: Record<string, string> = {
    analyzed: "Tahlil qilingan",
    review: "Ko'rikda",
    draft: "Qoralama",
    active: "Faol",
    overdue: "Kechikkan",
    completed: "Bajarildi",
    archived: "Arxiv",
    pending: "Kutilmoqda",
    progress: "Jarayonda",
    done: "Tugadi",
    testing: "Sinovda",
    approved: "Tasdiqlangan",
    promoted: "Global",
    discarded: "Rad etilgan",
  };
  return labels[status] ?? status;
}

export function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

function roleToOwner(role: string) {
  const normalized = role.toLowerCase();
  if (normalized.includes("finance")) return "Malika S.";
  if (normalized.includes("operation")) return "Bekzod N.";
  if (normalized.includes("management")) return "Samandar T.";
  if (normalized.includes("legal")) return "Aziza R.";
  return employees[0];
}

function sourceWithPage(source: string, pageNumber?: number | null) {
  if (!pageNumber) return source || "Manba ko'rsatilmagan";
  return source ? `${source} · ${pageNumber}-bet` : `${pageNumber}-bet`;
}

export function apiToRun(api: ApiLegalAnalysis): AnalysisRun {
  const id = `CTR-${Date.now()}`;
  const doc = api.document;
  const risks: Risk[] = api.risks.map((risk) => ({
    id: risk.id || makeId("R"),
    title: risk.title,
    detail: risk.detail,
    severity: risk.severity,
    confidence: risk.confidence,
    pageNumber: risk.page_number,
    recommendation: risk.recommendation,
    source: sourceWithPage(risk.source, risk.page_number),
  }));
  const fields: ContractField[] = api.fields.map((field) => ({
    label: field.label,
    value: field.value,
    confidence: field.confidence,
    pageNumber: field.page_number,
    needsReview: field.needs_review,
    source: sourceWithPage(field.source, field.page_number),
  }));
  return {
    id: api.id || makeId("RUN"),
    stage: "done",
    processingMs: api.processing_ms,
    modelUsed: api.model_used,
    reviewQueue: api.review_queue || [],
    alerts: api.alerts || [],
    summary: api.summary,
    contract: {
      id,
      title: doc.title || doc.file_name.replace(/\.pdf$/i, ""),
      fileName: doc.file_name,
      counterparty: doc.counterparty || "Aniqlanmadi",
      type: doc.sub_type || doc.contract_type || doc.document_class || "Aniqlanmadi",
      language: doc.language || "unknown",
      status: "review",
      riskLevel: doc.risk_level,
      aiScore: doc.ai_score,
      uploadedAt: "2026-07-06",
      value: doc.value || "Aniqlanmadi",
      term: doc.term || [doc.effective_date, doc.end_date].filter(Boolean).join(" - ") || "Aniqlanmadi",
      law: doc.governing_law || "Aniqlanmadi",
      fields,
      risks,
    },
    obligations: api.obligations.map((obligation) => ({
      id: obligation.id || makeId("OB"),
      contractId: id,
      title: obligation.title,
      description: obligation.description || obligation.deadline_text,
      owner: roleToOwner(obligation.owner_role),
      dueDate: obligation.due_date || "",
      status: "review",
      confidence: obligation.confidence,
      source: sourceWithPage(obligation.source, obligation.page_number),
      category: obligation.category,
      kept: obligation.kept !== false,
    })),
  };
}

export function buildSearchMatches(query: string, contracts: Contract[], obligations: Obligation[], tasks: Task[]): SearchMatch[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  const matches: SearchMatch[] = [];
  const includes = (value: string | undefined) => value?.toLowerCase().includes(normalized);

  for (const contract of contracts) {
    if ([contract.title, contract.counterparty, contract.type, contract.value, contract.term, contract.law].some(includes)) {
      matches.push({
        id: `contract-${contract.id}`,
        section: "contracts",
        contractId: contract.id,
        label: contract.title,
        detail: `${contract.counterparty} · ${contract.type}`,
      });
    }

    contract.fields.forEach((field, index) => {
      if ([field.label, field.value, field.source].some(includes)) {
        matches.push({
          id: `field-${contract.id}-${index}`,
          section: "contracts",
          contractId: contract.id,
          label: `${field.label}: ${field.value}`,
          detail: `${contract.title} · ${field.source}`,
        });
      }
    });

    contract.risks.forEach((risk) => {
      if ([risk.title, risk.detail, risk.source, risk.recommendation].some(includes)) {
        matches.push({
          id: `risk-${contract.id}-${risk.id}`,
          section: "contracts",
          contractId: contract.id,
          label: risk.title,
          detail: `${riskLabel(risk.severity)} risk · ${contract.title}`,
        });
      }
    });
  }

  obligations.forEach((obligation) => {
    if ([obligation.title, obligation.description, obligation.owner, obligation.source, obligation.category].some(includes)) {
      matches.push({
        id: `obligation-${obligation.id}`,
        section: "obligations",
        contractId: obligation.contractId,
        label: obligation.title,
        detail: `${obligation.owner} · ${fmtDate(obligation.dueDate)} · ${statusLabel(obligation.status)}`,
      });
    }
  });

  tasks.forEach((task) => {
    if ([task.title, task.owner, task.dueDate, task.status, task.priority].some(includes)) {
      matches.push({
        id: `task-${task.id}`,
        section: "tasks",
        contractId: task.contractId,
        label: task.title,
        detail: `${task.owner} · ${fmtDate(task.dueDate)} · ${statusLabel(task.status)}`,
      });
    }
  });

  return matches.slice(0, 10);
}
