#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const DEFAULT_CASES = "datasets/golden/cases.json";
const DEFAULT_API = "http://localhost:5174";
const DEFAULT_THRESHOLD = 0.8;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rootDir = process.cwd();
  const threshold = Number(args.threshold || DEFAULT_THRESHOLD);
  const reportsDir = resolvePath(rootDir, args.reportsDir || "reports/evaluation");
  fs.mkdirSync(reportsDir, { recursive: true });

  const results = args.actual
    ? [await evaluateSingleActual(rootDir, args)]
    : await evaluateCases(rootDir, args);

  const aggregate = aggregateResults(results, threshold);
  const report = {
    generatedAt: new Date().toISOString(),
    threshold,
    aggregate,
    results,
  };
  const outPath = resolvePath(rootDir, args.out || path.join(reportsDir, `evaluation-${Date.now()}.json`));
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  printSummary(report, outPath);
  process.exitCode = aggregate.pass ? 0 : 1;
}

async function evaluateCases(rootDir, args) {
  const casesPath = resolvePath(rootDir, args.cases || DEFAULT_CASES);
  const manifest = readJson(casesPath);
  const apiBase = args.api || process.env.LEGALAI_API_BASE || DEFAULT_API;
  const cases = Array.isArray(manifest.cases) ? manifest.cases : [];

  if (!cases.length) {
    throw new Error(`No cases found in ${casesPath}`);
  }

  const results = [];
  for (const testCase of cases) {
    const expectedPath = resolvePath(rootDir, testCase.expectedPath);
    const expected = readJson(expectedPath);
    const actual = testCase.actualPath
      ? readJson(resolvePath(rootDir, testCase.actualPath))
      : await analyzePdf(apiBase, testCase.pdfPath);
    results.push(evaluateActual({ id: testCase.id, title: testCase.title, expected, actual }));
  }
  return results;
}

async function evaluateSingleActual(rootDir, args) {
  if (!args.expected) {
    throw new Error("--expected is required when --actual is used");
  }
  const expected = readJson(resolvePath(rootDir, args.expected));
  const actual = readJson(resolvePath(rootDir, args.actual));
  return evaluateActual({
    id: args.id || expected.id || "single-actual",
    title: args.title || "Single actual JSON evaluation",
    expected,
    actual,
  });
}

function evaluateActual({ id, title, expected, actual }) {
  const sections = {
    document: scoreDocument(expected.document || {}, actual.document || {}),
    minimums: scoreMinimums(expected.minimums || {}, actual),
    fields: scoreExpectedList("fields", expected.requiredFields || [], actual.fields || []),
    risks: scoreExpectedList("risks", expected.requiredRisks || [], actual.risks || []),
    obligations: scoreExpectedList("obligations", expected.requiredObligations || [], actual.obligations || []),
    review_queue: scoreExpectedList("review_queue", expected.requiredReviewQueue || [], actual.review_queue || []),
    alerts: scoreExpectedList("alerts", expected.requiredAlerts || [], actual.alerts || []),
  };

  const weighted = Object.values(sections).reduce((sum, section) => sum + section.weightedScore, 0);
  const totalWeight = Object.values(sections).reduce((sum, section) => sum + section.weight, 0);
  const overall = totalWeight ? weighted / totalWeight : 0;

  return {
    id,
    title,
    model: actual.model_used || null,
    processingMs: actual.processing_ms || null,
    overall: round(overall),
    sections,
  };
}

function scoreDocument(expected, actualDoc) {
  const checks = [];
  checks.push(checkExact("document_class", expected.document_class, actualDoc.document_class, 3));
  checks.push(checkExact("language", expected.language, actualDoc.language, 2));
  checks.push(checkAnyTerm("contract_type", expected.contract_type_any, joinValues(actualDoc.contract_type, actualDoc.sub_type, actualDoc.title), 3));
  checks.push(checkTerms("counterparty", expected.counterparty_terms, joinValues(actualDoc.counterparty, actualDoc.title), 3));
  checks.push(checkTerms("value", expected.value_terms, joinValues(actualDoc.value, actualDoc.currency), 3));
  checks.push(checkTerms("dates", expected.date_terms, joinValues(actualDoc.effective_date, actualDoc.end_date, actualDoc.term), 3));
  checks.push(checkTerms("law", expected.law_terms, joinValues(actualDoc.governing_law, actualDoc.term), 1));
  return summarizeChecks("document", checks);
}

function scoreMinimums(minimums, actual) {
  const checks = [];
  for (const key of ["fields", "risks", "obligations", "review_queue", "alerts"]) {
    if (Number.isFinite(Number(minimums[key]))) {
      const actualCount = Array.isArray(actual[key]) ? actual[key].length : 0;
      checks.push({
        id: `min-${key}`,
        score: Math.min(actualCount / Number(minimums[key]), 1),
        weight: 1,
        pass: actualCount >= Number(minimums[key]),
        detail: `${actualCount}/${minimums[key]}`,
      });
    }
  }
  if (Number.isFinite(Number(minimums.page_citation_rate))) {
    const citedItems = [...ensureArray(actual.fields), ...ensureArray(actual.risks), ...ensureArray(actual.obligations)];
    const citedCount = citedItems.filter((item) => Number(item.page_number) > 0 || Number(item.pageNumber) > 0 || /(^|\D)\d+\s*-\s*bet/i.test(String(item.source || ""))).length;
    const rate = citedItems.length ? citedCount / citedItems.length : 0;
    checks.push({
      id: "page-citation-rate",
      score: Math.min(rate / Number(minimums.page_citation_rate), 1),
      weight: 2,
      pass: rate >= Number(minimums.page_citation_rate),
      detail: `${round(rate * 100)}%/${round(Number(minimums.page_citation_rate) * 100)}%`,
    });
  }
  return summarizeChecks("minimums", checks);
}

function scoreExpectedList(sectionName, expectedItems, actualItems) {
  const checks = expectedItems.map((expected) => {
    const match = bestMatch(expected, actualItems);
    return {
      id: expected.id,
      score: match.score,
      weight: Number(expected.weight || 1),
      pass: match.score >= 0.55,
      detail: match.detail,
      matchedText: match.text.slice(0, 280),
    };
  });
  return summarizeChecks(sectionName, checks);
}

function bestMatch(expected, actualItems) {
  let best = { score: 0, detail: "not found", text: "" };
  for (const item of actualItems) {
    const text = textOf(item);
    const terms = ensureArray(expected.terms);
    const termHits = terms.filter((term) => includesTerm(text, term)).length;
    const termScore = terms.length ? termHits / terms.length : 1;
    const pageScore = expected.page ? pageMatches(item, expected.page) : 1;
    const severityScore = expected.severity ? compatibleValue(item.severity, expected.severity) : 1;
    const categoryScore = expected.category ? compatibleValue(item.category, expected.category) : 1;
    const ownerScore = expected.owner_role_any ? compatibleAny(item.owner_role || item.owner, expected.owner_role_any) : 1;
    const priorityScore = expected.priority_any ? compatibleAny(item.priority, expected.priority_any) : 1;
    const daysScore = expected.days_before_any ? compatibleAny(Number(item.days_before), expected.days_before_any.map(Number)) : 1;

    const conditionScore = average([pageScore, severityScore, categoryScore, ownerScore, priorityScore, daysScore]);
    const score = (termScore * 0.8) + (conditionScore * 0.2);
    if (score > best.score) {
      best = {
        score: round(score),
        detail: `${termHits}/${terms.length || 0} terms, conditions ${round(conditionScore * 100)}%`,
        text,
      };
    }
  }
  return best;
}

async function analyzePdf(apiBase, pdfPath) {
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF not found: ${pdfPath}. Run scripts/make-test-pdf.py first or update datasets/golden/cases.json`);
  }
  const endpoint = apiBase.replace(/\/$/, "") + "/api/analyze-pdf";
  const boundary = `----legalai-eval-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const fileBuffer = fs.readFileSync(pdfPath);
  const header = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="pdf"; filename="${path.basename(pdfPath)}"\r\n` +
    `Content-Type: application/pdf\r\n\r\n`,
  );
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([header, fileBuffer, footer]);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      "Content-Length": String(body.length),
    },
    body,
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`API ${response.status}: ${text.slice(0, 2000)}`);
  }
  return JSON.parse(text);
}

function summarizeChecks(name, checks) {
  const weight = checks.reduce((sum, check) => sum + Number(check.weight || 1), 0);
  const weightedScore = checks.reduce((sum, check) => sum + Number(check.weight || 1) * check.score, 0);
  return {
    name,
    score: round(weight ? weightedScore / weight : 1),
    weight,
    weightedScore,
    passed: checks.filter((check) => check.pass).length,
    total: checks.length,
    checks,
  };
}

function aggregateResults(results, threshold) {
  const overall = results.length ? results.reduce((sum, item) => sum + item.overall, 0) / results.length : 0;
  return {
    cases: results.length,
    overall: round(overall),
    pass: overall >= threshold,
  };
}

function checkExact(id, expected, actual, weight = 1) {
  if (!expected) return { id, score: 1, weight, pass: true, detail: "not required" };
  const pass = normalize(actual) === normalize(expected);
  return { id, score: pass ? 1 : 0, weight, pass, detail: `${actual || ""}` };
}

function checkAnyTerm(id, expectedTerms, actualText, weight = 1) {
  const terms = ensureArray(expectedTerms);
  if (!terms.length) return { id, score: 1, weight, pass: true, detail: "not required" };
  const pass = terms.some((term) => includesTerm(actualText, term));
  return { id, score: pass ? 1 : 0, weight, pass, detail: actualText || "" };
}

function checkTerms(id, expectedTerms, actualText, weight = 1) {
  const terms = ensureArray(expectedTerms);
  if (!terms.length) return { id, score: 1, weight, pass: true, detail: "not required" };
  const hits = terms.filter((term) => includesTerm(actualText, term)).length;
  const score = hits / terms.length;
  return { id, score: round(score), weight, pass: score >= 0.65, detail: `${hits}/${terms.length} terms` };
}

function compatibleValue(actual, expected) {
  return normalize(actual) === normalize(expected) ? 1 : 0;
}

function compatibleAny(actual, expectedValues) {
  const normalized = normalize(actual);
  return expectedValues.some((expected) => normalize(expected) === normalized || normalized.includes(normalize(expected)) || normalize(expected).includes(normalized)) ? 1 : 0;
}

function pageMatches(item, expectedPage) {
  const page = Number(item.page_number || item.pageNumber);
  if (page === Number(expectedPage)) return 1;
  if (String(item.source || "").includes(`${expectedPage}-bet`) || String(item.source || "").toLowerCase().includes(`page ${expectedPage}`)) return 1;
  return 0;
}

function textOf(item) {
  return joinValues(
    item.id,
    item.label,
    item.value,
    item.title,
    item.detail,
    item.description,
    item.reason,
    item.owner_role,
    item.owner,
    item.deadline_text,
    item.due_date,
    item.trigger,
    item.recommended_owner_role,
    item.source,
    item.recommendation,
    item.category,
    item.severity,
    item.priority,
  );
}

function joinValues(...values) {
  return values.filter((value) => value !== undefined && value !== null).map(String).join(" ");
}

function includesTerm(text, term) {
  const normalizedText = normalize(text);
  const normalizedTerm = normalize(term);
  if (!normalizedTerm) return true;
  return normalizedText.includes(normalizedTerm);
}

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[`'"]/g, "")
    .replace(/[,\u00a0]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function average(values) {
  const filtered = values.filter((value) => Number.isFinite(value));
  return filtered.length ? filtered.reduce((sum, value) => sum + value, 0) / filtered.length : 1;
}

function round(value) {
  return Math.round(Number(value || 0) * 10000) / 10000;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function resolvePath(rootDir, filePath) {
  return path.isAbsolute(filePath) ? filePath : path.join(rootDir, filePath);
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    index += 1;
  }
  return args;
}

function printSummary(report, outPath) {
  const pct = (value) => `${Math.round(value * 1000) / 10}%`;
  console.log(`ML evaluation: ${report.aggregate.pass ? "PASS" : "FAIL"} ${pct(report.aggregate.overall)} (${report.aggregate.cases} case)`);
  for (const result of report.results) {
    console.log(`- ${result.id}: ${pct(result.overall)} model=${result.model || "unknown"} ms=${result.processingMs || "n/a"}`);
    for (const [name, section] of Object.entries(result.sections)) {
      console.log(`  ${name}: ${pct(section.score)} (${section.passed}/${section.total})`);
    }
  }
  console.log(`Report: ${outPath}`);
}

main().catch((error) => {
  console.error(`ML evaluation failed: ${error.message}`);
  process.exit(1);
});
