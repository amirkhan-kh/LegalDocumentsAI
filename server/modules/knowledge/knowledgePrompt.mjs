export function buildKnowledgeIngestionPrompt({ fileName, title, domain, language, text = "" }) {
  return `
You are a knowledge-ingestion engine for a business-specific LegalAI workspace.
Convert the uploaded client document into a concise, reliable grounding playbook for future AI legal and business decisions.

The document can be a legal policy, CRM script, Bitrix/amoCRM process, approval matrix, contract checklist, internal rule, pricing policy, risk playbook, or operational guideline.

Return STRICT JSON only. Do not include markdown.
Do not invent rules that are not in the document. If the document is vague, preserve that uncertainty.

Metadata:
- file_name: ${fileName}
- user_title: ${title || ""}
- user_domain: ${domain || ""}
- user_language: ${language || ""}

${text ? `Document text:\n${text.slice(0, 60000)}` : "The document is attached as a file part."}

JSON shape:
{
  "title": "short clear title",
  "domain": "Legal|Sales|CRM|Finance|Operations|Compliance|HR|Procurement|Other",
  "language": "uz|ru|en|mixed|unknown",
  "summary": "2-4 sentence summary in Uzbek",
  "content": "grounding rules and procedures in markdown bullet format. Preserve exact thresholds, deadlines, approval levels, CRM stages, escalation rules, legal rules, risk criteria, and exception logic.",
  "tags": ["short", "searchable", "tags"]
}

Quality requirements:
- Extract decision rules, not just a generic summary.
- Include exact numbers, deadlines, thresholds, names of CRM stages, department roles, and approval conditions.
- If a rule affects contract analysis, label it clearly.
- If a rule affects obligations, alerts, task assignment, risk severity, or approval routing, label it clearly.
- Keep source-specific wording when it is important.
`;
}
