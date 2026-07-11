export function normalizeAnalysis(raw, fileName, startedAt, modelUsed = "") {
  const doc = raw.document || {};
  const fields = ensureArray(raw.fields).map((field, index) => ({
    id: String(field.id || `F-${index + 1}`),
    label: String(field.label || "Maydon"),
    value: String(field.value || ""),
    confidence: toConfidence(field.confidence),
    page_number: toPage(field.page_number),
    source: String(field.source || ""),
    needs_review: Boolean(field.needs_review || toConfidence(field.confidence) < 85),
  }));
  const risks = ensureArray(raw.risks).map((risk, index) => ({
    id: String(risk.id || `R-${index + 1}`),
    title: String(risk.title || "Risk"),
    detail: String(risk.detail || ""),
    severity: toSeverity(risk.severity),
    confidence: toConfidence(risk.confidence),
    page_number: toPage(risk.page_number),
    source: String(risk.source || ""),
    recommendation: String(risk.recommendation || ""),
  }));
  const obligations = ensureArray(raw.obligations).map((obligation, index) => ({
    id: String(obligation.id || `OB-${index + 1}`),
    title: String(obligation.title || "Majburiyat"),
    description: String(obligation.description || ""),
    owner_role: String(obligation.owner_role || "Unassigned"),
    due_date: String(obligation.due_date || ""),
    deadline_text: String(obligation.deadline_text || ""),
    status: "review",
    importance: String(obligation.importance || "normal"),
    confidence: toConfidence(obligation.confidence),
    page_number: toPage(obligation.page_number),
    source: String(obligation.source || ""),
    category: String(obligation.category || "Other"),
    recurrence: String(obligation.recurrence || "unknown"),
    kept: true,
  }));
  const reviewQueue = ensureArray(raw.review_queue).map((item, index) => ({
    item_type: String(item.item_type || "field"),
    item_id: String(item.item_id || `RQ-${index + 1}`),
    reason: String(item.reason || ""),
    priority: toPriority(item.priority),
  }));
  const alerts = ensureArray(raw.alerts).map((alert) => ({
    title: String(alert.title || ""),
    trigger: String(alert.trigger || ""),
    recommended_owner_role: String(alert.recommended_owner_role || ""),
    days_before: Number.isFinite(Number(alert.days_before)) ? Number(alert.days_before) : 0,
    source: String(alert.source || ""),
  }));
  const riskLevel = toSeverity(doc.risk_level || (risks.some((risk) => risk.severity === "high") ? "high" : risks.length ? "medium" : "low"));
  const score = Number.isFinite(Number(doc.ai_score))
    ? Math.max(0, Math.min(100, Math.round(Number(doc.ai_score))))
    : Math.max(55, Math.round(100 - risks.length * 8 - fields.filter((field) => field.needs_review).length * 3));

  return {
    id: `RUN-${Date.now()}`,
    model_used: raw.__model_used || modelUsed,
    processing_ms: Date.now() - startedAt,
    document: {
      title: String(doc.title || fileName.replace(/\.pdf$/i, "")),
      file_name: fileName,
      language: String(doc.language || "unknown"),
      document_class: String(doc.document_class || "unknown"),
      contract_type: String(doc.contract_type || ""),
      sub_type: String(doc.sub_type || ""),
      counterparty: String(doc.counterparty || ""),
      effective_date: String(doc.effective_date || ""),
      end_date: String(doc.end_date || ""),
      term: String(doc.term || ""),
      value: String(doc.value || ""),
      currency: String(doc.currency || ""),
      governing_law: String(doc.governing_law || ""),
      ai_score: score,
      risk_level: riskLevel,
    },
    fields,
    risks,
    obligations,
    review_queue: reviewQueue,
    alerts,
    summary: {
      short: String(raw.summary?.short || ""),
      what_to_check_first: ensureArray(raw.summary?.what_to_check_first).map(String),
      processing_notes: ensureArray(raw.summary?.processing_notes).map(String),
    },
  };
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function toConfidence(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, Math.round(number))) : 0;
}

function toPage(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : null;
}

function toSeverity(value) {
  return ["low", "medium", "high"].includes(value) ? value : "medium";
}

function toPriority(value) {
  return ["low", "medium", "high"].includes(value) ? value : "medium";
}
