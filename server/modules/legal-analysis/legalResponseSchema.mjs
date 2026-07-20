const text = { type: "string" };
const integer = { type: "integer" };
const boolean = { type: "boolean" };
const anyValue = {};

function object(properties) {
  return {
    type: "object",
    required: Object.keys(properties),
    properties,
  };
}

function objectArray(properties) {
  return {
    type: "array",
    items: object(properties),
  };
}

export const legalAnalysisResponseSchema = object({
  document: object({
    title: text,
    file_name: text,
    language: text,
    document_class: text,
    contract_type: text,
    sub_type: text,
    counterparty: text,
    effective_date: text,
    end_date: text,
    term: text,
    value: text,
    currency: text,
    governing_law: text,
    ai_score: integer,
    risk_level: text,
  }),
  fields: objectArray({
    id: text,
    label: text,
    value: text,
    confidence: integer,
    page_number: anyValue,
    source: text,
    needs_review: boolean,
  }),
  risks: objectArray({
    id: text,
    title: text,
    detail: text,
    severity: text,
    confidence: integer,
    page_number: anyValue,
    source: text,
    recommendation: text,
  }),
  obligations: objectArray({
    id: text,
    title: text,
    description: text,
    owner_role: text,
    due_date: text,
    deadline_text: text,
    status: text,
    importance: text,
    confidence: integer,
    page_number: anyValue,
    source: text,
    category: text,
    recurrence: text,
  }),
  review_queue: objectArray({
    item_type: text,
    item_id: text,
    reason: text,
    priority: text,
  }),
  alerts: objectArray({
    title: text,
    trigger: text,
    recommended_owner_role: text,
    days_before: integer,
    source: text,
  }),
  summary: object({
    short: text,
    what_to_check_first: { type: "array", items: text },
    processing_notes: { type: "array", items: text },
  }),
});
