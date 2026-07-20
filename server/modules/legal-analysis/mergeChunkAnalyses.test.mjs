import assert from "node:assert/strict";
import test from "node:test";
import { mergeChunkAnalyses } from "./mergeChunkAnalyses.mjs";

const chunks = [
  {
    pageStart: 1,
    pageEnd: 2,
    analysis: {
      __model_used: "gemini-2.5-pro",
      __transport: "gcs",
      __timing: { staging_ms: 10, model_ms: 80, total_ms: 100 },
      document: { title: "Master Agreement", language: "en", ai_score: 80, risk_level: "medium", counterparty: "Nova Ltd." },
      fields: [
        { id: "F-1", label: "Qiymat", value: "1,250,000,000 UZS", confidence: 84, page_number: 2, source: "Clause 4.1" },
      ],
      risks: [
        { id: "R-1", title: "Auto renewal", detail: "Renews for 12 months", severity: "high", confidence: 90, page_number: 2, source: "Clause 10.1" },
      ],
      obligations: [
        { id: "OB-1", title: "Invoice payment", description: "Pay invoices", owner_role: "Finance", due_date: "", deadline_text: "30 days", confidence: 88, page_number: 2, source: "Clause 5.2" },
      ],
      review_queue: [{ item_type: "risk", item_id: "R-1", reason: "Clause 10.1 auto-renewal", priority: "medium" }],
      alerts: [{ title: "Renewal notice", trigger: "60 days", source: "Clause 10.1", days_before: 30 }],
      summary: { short: "Commercial agreement.", what_to_check_first: ["Renewal"], processing_notes: ["Text PDF"] },
    },
  },
  {
    pageStart: 3,
    pageEnd: 4,
    analysis: {
      __model_used: "gemini-2.5-pro",
      __transport: "gcs",
      __timing: { staging_ms: 12, model_ms: 70, total_ms: 95 },
      document: { language: "ru", ai_score: 90, risk_level: "high", governing_law: "England and Wales" },
      fields: [
        { id: "F-1", label: "Qiymat", value: "1,250,000,000 UZS", confidence: 96, page_number: 1, source: "Clause 4.1" },
        { id: "F-2", label: "Amal qiluvchi qonun", value: "England and Wales", confidence: 92, page_number: 2, source: "Clause 14" },
      ],
      risks: [
        { id: "R-1", title: "Auto renewal", detail: "Renews for 12 months", severity: "high", confidence: 85, page_number: 1, source: "Clause 10.1" },
      ],
      obligations: [
        { id: "OB-1", title: "ISO certificate", description: "Deliver certificate", owner_role: "Operations", due_date: "2026-07-01", deadline_text: "", confidence: 91, page_number: 2, source: "Clause 11.1" },
      ],
      review_queue: [
        { item_type: "field", item_id: "F-1", reason: "Confirm contract value", priority: "high" },
        { item_type: "obligation", item_id: "OB-1", reason: "ISO certificate overdue", priority: "high" },
      ],
      alerts: [{ title: "Renewal notice", trigger: "60 days", source: "Clause 10.1", days_before: 30 }],
      summary: { short: "Includes compliance duties.", what_to_check_first: ["ISO certificate", "Renewal"], processing_notes: ["Text PDF"] },
    },
  },
];

test("mergeChunkAnalyses offsets pages, deduplicates items and remaps review IDs", () => {
  const result = mergeChunkAnalyses(chunks, { fileName: "combined.pdf" });

  assert.equal(result.document.file_name, "combined.pdf");
  assert.equal(result.document.language, "mixed");
  assert.equal(result.document.ai_score, 85);
  assert.equal(result.document.risk_level, "high");
  assert.equal(result.fields.length, 2);
  assert.deepEqual(result.fields.map(({ id, label, confidence, page_number }) => ({ id, label, confidence, page_number })), [
    { id: "F-1", label: "Qiymat", confidence: 96, page_number: 3 },
    { id: "F-2", label: "Amal qiluvchi qonun", confidence: 92, page_number: 4 },
  ]);
  assert.equal(result.risks.length, 1);
  assert.equal(result.risks[0].id, "R-1");
  assert.equal(result.risks[0].page_number, 2);
  assert.deepEqual(result.obligations.map(({ id, page_number }) => ({ id, page_number })), [
    { id: "OB-1", page_number: 2 },
    { id: "OB-2", page_number: 4 },
  ]);
  assert.deepEqual(result.review_queue.map(({ item_type, item_id }) => ({ item_type, item_id })), [
    { item_type: "field", item_id: "F-1" },
    { item_type: "obligation", item_id: "OB-2" },
    { item_type: "risk", item_id: "R-1" },
  ]);
  assert.equal(result.alerts.length, 1);
  assert.equal(result.summary.short, "Commercial agreement. Includes compliance duties.");
  assert.deepEqual(result.summary.what_to_check_first, ["Renewal", "ISO certificate"]);
  assert.deepEqual(result.__timing, {
    chunk_count: 2,
    staging_ms: 22,
    model_ms: 150,
    total_ms: 100,
    aggregation: "parallel_chunks",
  });
});

test("mergeChunkAnalyses is deterministic when chunk input order changes", () => {
  const forward = mergeChunkAnalyses(chunks, { fileName: "combined.pdf" });
  const reverse = mergeChunkAnalyses([...chunks].reverse(), { fileName: "combined.pdf" });
  assert.deepEqual(reverse, forward);
});

test("mergeChunkAnalyses rejects invalid page ranges", () => {
  assert.throws(
    () => mergeChunkAnalyses([{ pageStart: 0, pageEnd: 2, analysis: {} }]),
    (error) => error.code === "PDF_CHUNK_MERGE_INPUT_ERROR",
  );
});
