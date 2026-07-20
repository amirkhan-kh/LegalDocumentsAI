export function normalizeAnalysis(raw, fileName, startedAt, modelUsed = "") {
  const doc = raw.document || {};
  const extractedFields = ensureArray(raw.fields).map((field, index) => ({
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
  const extractedAlerts = ensureArray(raw.alerts).map((alert) => ({
    title: String(alert.title || ""),
    trigger: String(alert.trigger || ""),
    recommended_owner_role: String(alert.recommended_owner_role || ""),
    days_before: Number.isFinite(Number(alert.days_before)) ? Number(alert.days_before) : 0,
    source: String(alert.source || ""),
  }));
  const fields = addDocumentFields(extractedFields, doc, [...risks, ...obligations]);
  const alerts = addObligationAlerts(extractedAlerts, obligations);
  const riskLevel = toSeverity(doc.risk_level || (risks.some((risk) => risk.severity === "high") ? "high" : risks.length ? "medium" : "low"));
  const score = Number.isFinite(Number(doc.ai_score))
    ? Math.max(0, Math.min(100, Math.round(Number(doc.ai_score))))
    : Math.max(55, Math.round(100 - risks.length * 8 - fields.filter((field) => field.needs_review).length * 3));

  return {
    id: `RUN-${Date.now()}`,
    model_used: raw.__model_used || modelUsed,
    transport_used: raw.__transport || "unknown",
    timing: raw.__timing || null,
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

function addDocumentFields(fields, document, evidenceItems) {
  const definitions = [
    { id: "f_effective_date", label: "Kuchga kirish sanasi", value: document.effective_date },
    { id: "f_end_date", label: "Dastlabki muddat tugash sanasi", value: document.end_date },
  ];
  const nextFields = [...fields];
  for (const definition of definitions) {
    const value = String(definition.value || "").trim();
    if (!value || nextFields.some((field) => normalizeText(field.value) === normalizeText(value))) continue;
    const evidence = evidenceItems.find((item) => normalizeText(JSON.stringify(item)).includes(normalizeText(value)));
    nextFields.push({
      id: definition.id,
      label: definition.label,
      value,
      confidence: toConfidence(document.ai_score || 85),
      page_number: evidence?.page_number ?? null,
      source: String(evidence?.source || "Document summary"),
      needs_review: !evidence,
    });
  }
  return nextFields;
}

function addObligationAlerts(alerts, obligations) {
  const nextAlerts = [...alerts];
  for (const obligation of obligations) {
    const trigger = String(obligation.due_date || obligation.deadline_text || "").trim();
    if (!trigger) continue;
    const normalizedSource = normalizeText(obligation.source);
    const normalizedTitle = normalizeText(obligation.title);
    const alreadyCovered = nextAlerts.some((alert) => {
      const alertText = normalizeText(`${alert.title} ${alert.trigger} ${alert.source}`);
      return (normalizedSource && alertText.includes(normalizedSource.slice(0, 42))) || significantWords(normalizedTitle).filter((word) => alertText.includes(word)).length >= 2;
    });
    if (alreadyCovered) continue;
    nextAlerts.push({
      title: `${obligation.title} muddati`,
      trigger,
      recommended_owner_role: obligation.owner_role,
      days_before: reminderDays(obligation.category),
      source: obligation.source,
    });
  }
  return nextAlerts;
}

function reminderDays(category) {
  if (category === "Renewal" || category === "Termination") return 30;
  if (category === "Compliance") return 14;
  return 7;
}

function significantWords(value) {
  return normalizeText(value).split(" ").filter((word) => word.length >= 5);
}

function normalizeText(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9а-яё]+/gi, " ").trim();
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
