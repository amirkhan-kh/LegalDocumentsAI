const COLLECTIONS = {
  fields: { prefix: "F", type: "field", key: fieldKey },
  risks: { prefix: "R", type: "risk", key: riskKey },
  obligations: { prefix: "OB", type: "obligation", key: obligationKey },
};

export function mergeChunkAnalyses(chunkAnalyses, options = {}) {
  const chunks = normalizeChunks(chunkAnalyses);
  const mergedCollections = Object.fromEntries(
    Object.entries(COLLECTIONS).map(([collectionName, definition]) => [
      collectionName,
      mergeCollection(chunks, collectionName, definition),
    ]),
  );

  const merged = {
    document: mergeDocuments(chunks, options.fileName),
    fields: mergedCollections.fields.items,
    risks: mergedCollections.risks.items,
    obligations: mergedCollections.obligations.items,
    review_queue: mergeReviewQueue(chunks, mergedCollections),
    alerts: mergeAlerts(chunks),
    summary: mergeSummaries(chunks),
  };

  const modelUsed = uniqueStrings(chunks.map((chunk) => chunk.analysis.__model_used));
  const transports = uniqueStrings(chunks.map((chunk) => chunk.analysis.__transport));
  const timing = mergeTiming(chunks);
  if (modelUsed.length) merged.__model_used = modelUsed.join(", ");
  if (transports.length) merged.__transport = transports.join(", ");
  if (timing) merged.__timing = timing;
  return merged;
}

function normalizeChunks(chunkAnalyses) {
  if (!Array.isArray(chunkAnalyses) || chunkAnalyses.length === 0) {
    throw mergeError("Merge uchun kamida bitta PDF chunk natijasi kerak.", "PDF_CHUNK_MERGE_INPUT_ERROR");
  }

  return chunkAnalyses
    .map((chunk, inputIndex) => {
      const pageStart = toPositiveInteger(chunk?.pageStart);
      const pageEnd = toPositiveInteger(chunk?.pageEnd);
      if (!pageStart || !pageEnd || pageEnd < pageStart) {
        throw mergeError("Har bir chunk 1-based pageStart va pageEnd qiymatlariga ega bo'lishi kerak.", "PDF_CHUNK_MERGE_INPUT_ERROR");
      }
      if (!chunk.analysis || typeof chunk.analysis !== "object" || Array.isArray(chunk.analysis)) {
        throw mergeError("Har bir chunk analysis JSON object qaytarishi kerak.", "PDF_CHUNK_MERGE_INPUT_ERROR");
      }
      return {
        analysis: chunk.analysis,
        inputIndex,
        pageStart,
        pageEnd,
        pageCount: pageEnd - pageStart + 1,
        chunkKey: `${pageStart}:${pageEnd}:${inputIndex}`,
      };
    })
    .sort((left, right) => left.pageStart - right.pageStart || left.pageEnd - right.pageEnd || left.inputIndex - right.inputIndex)
    .map((chunk, sortedIndex) => ({ ...chunk, chunkKey: `${chunk.pageStart}:${chunk.pageEnd}:${sortedIndex}` }));
}

function mergeCollection(chunks, collectionName, definition) {
  const candidates = [];
  const candidateKeysByReference = new Map();

  chunks.forEach((chunk) => {
    ensureArray(chunk.analysis[collectionName]).forEach((sourceItem, itemIndex) => {
      const item = sourceItem && typeof sourceItem === "object" && !Array.isArray(sourceItem) ? { ...sourceItem } : {};
      const pageNumber = toGlobalPage(item.page_number, chunk);
      const dedupeKey = definition.key(item) || `${chunk.chunkKey}:${itemIndex}`;
      const originalId = stringValue(item.id);
      item.page_number = pageNumber;
      candidates.push({
        chunkKey: chunk.chunkKey,
        dedupeKey,
        inputOrder: itemIndex,
        item,
        originalId,
      });
      if (originalId) candidateKeysByReference.set(`${chunk.chunkKey}:${originalId}`, dedupeKey);
    });
  });

  candidates.sort(compareCandidates);
  const bestByKey = new Map();
  for (const candidate of candidates) {
    const current = bestByKey.get(candidate.dedupeKey);
    if (!current || isBetterCandidate(candidate, current)) bestByKey.set(candidate.dedupeKey, candidate);
  }

  const winners = [...bestByKey.values()].sort(compareCandidates);
  const idByDedupeKey = new Map();
  const items = winners.map((winner, index) => {
    const id = `${definition.prefix}-${index + 1}`;
    idByDedupeKey.set(winner.dedupeKey, id);
    return { ...winner.item, id };
  });
  const referenceMap = new Map();
  candidateKeysByReference.forEach((dedupeKey, referenceKey) => {
    const id = idByDedupeKey.get(dedupeKey);
    if (id) referenceMap.set(referenceKey, id);
  });

  return { items, referenceMap, type: definition.type };
}

function mergeReviewQueue(chunks, mergedCollections) {
  const typeToCollection = Object.values(mergedCollections).reduce((result, collection) => {
    result[collection.type] = collection;
    return result;
  }, {});
  const bestByKey = new Map();

  chunks.forEach((chunk) => {
    ensureArray(chunk.analysis.review_queue).forEach((sourceItem, itemIndex) => {
      const item = sourceItem && typeof sourceItem === "object" && !Array.isArray(sourceItem) ? sourceItem : {};
      const itemType = normalizeItemType(item.item_type);
      const originalId = stringValue(item.item_id);
      const mappedId = typeToCollection[itemType]?.referenceMap.get(`${chunk.chunkKey}:${originalId}`);
      const itemId = mappedId || originalId || `RQ-${chunk.pageStart}-${itemIndex + 1}`;
      const normalized = {
        ...item,
        item_type: itemType || "field",
        item_id: itemId,
      };
      const dedupeKey = [normalized.item_type, normalized.item_id, canonical(normalized.reason)].join("|");
      const current = bestByKey.get(dedupeKey);
      if (!current || priorityRank(normalized.priority) > priorityRank(current.priority)) bestByKey.set(dedupeKey, normalized);
    });
  });

  return [...bestByKey.values()].sort((left, right) => (
    priorityRank(right.priority) - priorityRank(left.priority)
    || canonical(left.item_type).localeCompare(canonical(right.item_type))
    || canonical(left.item_id).localeCompare(canonical(right.item_id))
    || canonical(left.reason).localeCompare(canonical(right.reason))
  ));
}

function mergeAlerts(chunks) {
  const bestByKey = new Map();
  chunks.forEach((chunk) => {
    ensureArray(chunk.analysis.alerts).forEach((sourceItem, itemIndex) => {
      const item = sourceItem && typeof sourceItem === "object" && !Array.isArray(sourceItem) ? { ...sourceItem } : {};
      const dedupeKey = alertKey(item) || `${chunk.chunkKey}:${itemIndex}`;
      const current = bestByKey.get(dedupeKey);
      if (!current || alertCompleteness(item) > alertCompleteness(current)) bestByKey.set(dedupeKey, item);
    });
  });
  return [...bestByKey.entries()]
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([, item]) => item);
}

function mergeDocuments(chunks, fileName) {
  const documents = chunks.map((chunk) => chunk.analysis.document).filter((document) => document && typeof document === "object" && !Array.isArray(document));
  const merged = {};
  documents.forEach((document) => {
    Object.entries(document).forEach(([key, value]) => {
      if (!isMeaningful(merged[key]) && isMeaningful(value)) merged[key] = value;
    });
  });

  const languageValues = uniqueStrings(documents.map((document) => document.language).filter((language) => canonical(language) !== "unknown"));
  if (languageValues.some((language) => canonical(language) === "mixed") || languageValues.length > 1) merged.language = "mixed";
  else if (languageValues.length === 1) merged.language = languageValues[0];

  const scores = chunks.flatMap((chunk) => {
    const score = Number(chunk.analysis.document?.ai_score);
    return Number.isFinite(score) ? [{ score, weight: chunk.pageCount }] : [];
  });
  if (scores.length) {
    const totalWeight = scores.reduce((sum, item) => sum + item.weight, 0);
    merged.ai_score = Math.max(0, Math.min(100, Math.round(scores.reduce((sum, item) => sum + item.score * item.weight, 0) / totalWeight)));
  }

  const riskLevels = documents.map((document) => canonical(document.risk_level));
  if (riskLevels.length) merged.risk_level = highestRiskLevel(riskLevels);
  if (fileName) merged.file_name = String(fileName);
  return merged;
}

function mergeSummaries(chunks) {
  const summaries = chunks.map((chunk) => chunk.analysis.summary).filter((summary) => summary && typeof summary === "object" && !Array.isArray(summary));
  return {
    short: uniqueStrings(summaries.map((summary) => summary.short)).slice(0, 2).join(" "),
    what_to_check_first: uniqueStrings(summaries.flatMap((summary) => ensureArray(summary.what_to_check_first))).slice(0, 4),
    processing_notes: uniqueStrings(summaries.flatMap((summary) => ensureArray(summary.processing_notes))).slice(0, 4),
  };
}

function mergeTiming(chunks) {
  const timings = chunks.map((chunk) => chunk.analysis.__timing).filter((timing) => timing && typeof timing === "object" && !Array.isArray(timing));
  if (!timings.length) return null;
  return {
    chunk_count: chunks.length,
    staging_ms: sumNumbers(timings.map((timing) => timing.staging_ms)),
    model_ms: sumNumbers(timings.map((timing) => timing.model_ms)),
    total_ms: Math.max(...timings.map((timing) => finiteNumber(timing.total_ms)), 0),
    aggregation: "parallel_chunks",
  };
}

function toGlobalPage(value, chunk) {
  const localPage = toPositiveInteger(value);
  if (!localPage) return null;
  if (localPage <= chunk.pageCount) return chunk.pageStart + localPage - 1;
  if (localPage >= chunk.pageStart && localPage <= chunk.pageEnd) return localPage;
  return null;
}

function compareCandidates(left, right) {
  return compareNullablePages(left.item.page_number, right.item.page_number)
    || left.dedupeKey.localeCompare(right.dedupeKey)
    || left.chunkKey.localeCompare(right.chunkKey)
    || left.inputOrder - right.inputOrder;
}

function compareNullablePages(left, right) {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left - right;
}

function isBetterCandidate(candidate, current) {
  const confidenceDifference = finiteNumber(candidate.item.confidence) - finiteNumber(current.item.confidence);
  if (confidenceDifference !== 0) return confidenceDifference > 0;
  return compareCandidates(candidate, current) < 0;
}

function fieldKey(item) {
  const label = canonical(item.label);
  const value = canonical(item.value);
  const source = canonical(item.source);
  return label || value ? [label, value || source].join("|") : source;
}

function riskKey(item) {
  const title = canonical(item.title);
  const detail = canonical(item.detail);
  const source = canonical(item.source);
  return title || detail ? [title, detail || source].join("|") : source;
}

function obligationKey(item) {
  const values = [item.title, item.description, item.owner_role, item.due_date, item.deadline_text].map(canonical);
  return values.some(Boolean) ? values.join("|") : canonical(item.source);
}

function alertKey(item) {
  const values = [item.title, item.trigger, item.source].map(canonical);
  return values.some(Boolean) ? values.join("|") : "";
}

function alertCompleteness(item) {
  return [item.title, item.trigger, item.recommended_owner_role, item.source].filter(isMeaningful).length;
}

function normalizeItemType(value) {
  const normalized = canonical(value).replace(/s$/, "");
  return ["field", "risk", "obligation"].includes(normalized) ? normalized : "";
}

function highestRiskLevel(values) {
  if (values.includes("high")) return "high";
  if (values.includes("medium")) return "medium";
  return "low";
}

function priorityRank(value) {
  return { low: 1, medium: 2, high: 3 }[canonical(value)] || 0;
}

function uniqueStrings(values) {
  const seen = new Set();
  const result = [];
  values.forEach((value) => {
    if (!isMeaningful(value)) return;
    const text = String(value).trim();
    const key = canonical(text);
    if (!key || seen.has(key)) return;
    seen.add(key);
    result.push(text);
  });
  return result;
}

function canonical(value) {
  return String(value || "").toLocaleLowerCase("uz").normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function stringValue(value) {
  return isMeaningful(value) ? String(value).trim() : "";
}

function isMeaningful(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim() !== "";
  return true;
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function sumNumbers(values) {
  return values.reduce((sum, value) => sum + finiteNumber(value), 0);
}

function toPositiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function mergeError(message, code) {
  const error = new Error(message);
  error.code = code;
  error.status = 500;
  return error;
}
