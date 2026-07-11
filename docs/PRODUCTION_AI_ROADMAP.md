# LegalAI Production AI Roadmap

Maqsad: LegalAI loyihasini yirik bizneslar va muhim hujjatlar bilan ishlaydigan, o'lchanadigan aniqlikka ega, audit qilinadigan, xavfsiz AI hujjat boshqaruv tizimiga aylantirish.

## 0. Asosiy prinsip

95% aniqlik marketing shiori emas, test bilan isbotlanadigan metrika bo'lishi kerak.

Shuning uchun loyiha quyidagi zanjirga o'tishi kerak:

```text
PDF -> OCR/document understanding -> classification -> extraction -> validation -> citation -> human review -> feedback -> evaluation -> tuning/RAG update
```

LLM bitta qism xolos. Professional tizimda quyidagilar birga ishlaydi:

- RAG: qonunlar, shablonlar, ichki qoidalar, yuridik izohlar, kompaniya policylari.
- Supervised fine-tuning: aniq formatdagi extraction/classification vazifalarida modelni moslashtirish.
- Evaluation set: har bir hujjat turida o'lchanadigan benchmark.
- Human-in-the-loop: yurist tasdiqlagan tuzatishlar keyingi datasetga qaytadi.
- MLOps: model versiyasi, prompt versiyasi, test natijasi, audit log.
- Security: tenant isolation, encryption, access control, no default memory, data retention policy.

## 1. Hozirgi loyiha qayerda

Bor:

- PDF-only upload.
- Vertex Gemini orqali PDF document input.
- Uzbek/Russian/English extraction prompt.
- fields, risks, obligations, review_queue, alerts.
- routing, dashboard, contracts, obligations, tasks, templates, analytics, staff lab.
- local workspace state.

Yo'q yoki hali prototip:

- persistent database.
- user auth/RBAC.
- real file storage.
- RAG knowledge base.
- labeled dataset.
- automated evaluation.
- model/prompt registry.
- fine-tuning jobs.
- audit trail.
- integrations: Hujjat.uz, 1C, DiDox.
- webhooks.
- encryption/CMEK/data residency controls.

## 2. Dataset strategiyasi

### 2.1 Hujjat turlari

Boshlash uchun 8 ta class:

- commercial_services_agreement
- supply_contract
- lease_agreement
- employment_contract
- nda
- loan_or_finance_agreement
- addendum
- non_contract

Har bir class uchun kamida:

- 100 train PDF.
- 30 validation PDF.
- 30 test PDF.

Minimum birinchi benchmark:

```text
8 class x 160 hujjat = 1280 hujjat
```

### 2.2 Annotation schema

Har bir PDF uchun golden JSON:

```json
{
  "document": {
    "document_class": "contract",
    "contract_type": "commercial_services_agreement",
    "language": "uz|ru|en|mixed",
    "counterparty": "",
    "effective_date": "",
    "end_date": "",
    "value": "",
    "currency": "",
    "governing_law": ""
  },
  "fields": [],
  "risks": [],
  "obligations": [],
  "alerts": []
}
```

Har itemda majburiy:

- value.
- source text.
- page_number.
- confidence expectation.
- reviewer_id.
- label_version.

### 2.3 Labeling jarayoni

1. AI birinchi draft extraction qiladi.
2. Junior reviewer tekshiradi.
3. Senior lawyer tasdiqlaydi.
4. Disagreement bo'lsa adjudication.
5. Final JSON `golden dataset`ga tushadi.

## 3. Metrikalar

95% aniqlikni bitta umumiy son bilan o'lchamang. Alohida o'lchang:

- document_class_accuracy.
- contract_type_accuracy.
- field_exact_match.
- field_semantic_match.
- obligation_precision.
- obligation_recall.
- risk_precision.
- risk_recall.
- citation_accuracy.
- date_accuracy.
- money_accuracy.
- false_positive_rate.
- human_review_rate.

Target v1:

```text
document_class_accuracy >= 98%
contract_type_accuracy >= 95%
critical_fields_exact_match >= 95%
obligation_precision >= 95%
obligation_recall >= 90%
risk_precision >= 92%
citation_accuracy >= 90%
```

## 4. RAG qatlami

RAG modelni o'qitmaydi. U modelga javob paytida kerakli bilimni beradi.

Knowledge base:

- O'zbekiston qonunlari va kodekslari.
- Prezident qarorlari, VM qarorlari, vazirlik yo'riqnomalari.
- Shartnoma shablonlari.
- Kompaniya ichki policylari.
- Risk playbook.
- Clause library.
- Uzbek/Russian/English legal glossary.

Pipeline:

```text
source docs -> clean text -> chunk -> metadata -> embeddings -> vector DB -> retrieval -> LLM prompt
```

Metadata:

- jurisdiction.
- document_type.
- language.
- effective_date.
- source_url.
- authority_level.
- version.
- expiry_or_updated_at.

## 5. Fine-tuning qatlami

Fine-tuning RAGdan keyin qilinadi, oldin emas.

Fine-tuning uchun yaxshi vazifalar:

- contract type classification.
- structured JSON extraction.
- obligation classification.
- risk severity classification.
- Uzbek/Russian/English legal phrasing normalization.

Fine-tuning uchun yomon vazifalar:

- so'nggi qonunlarni modelga "yodlatish".
- tez o'zgaradigan ma'lumotlar.
- audit qilinishi kerak bo'lgan rasmiy manbalar.

Tez o'zgaradigan huquqiy bilimlar RAGda turadi, model vazifa formatini yaxshi bajarishga tuning qilinadi.

## 6. Recommended architecture

```text
frontend
  upload/review/workspace UI

api server
  auth, tenant, upload, jobs, webhooks

document service
  PDF storage, OCR, page images, text layer

ai orchestration service
  classify -> extract -> validate -> cite -> summarize

rag service
  law/policy/template retrieval

evaluation service
  golden dataset, scoring, regression tests

feedback service
  reviewer corrections -> dataset queue

database
  contracts, obligations, tasks, audit, model runs
```

## 7. Security baseline

Production talablar:

- Service account per environment.
- No credentials in frontend.
- Tenant isolation.
- Role-based access control.
- Encrypted file storage.
- Audit log for every view/extract/edit/export.
- Request/response logging disabled by default for sensitive docs.
- Explicit retention policy.
- Optional CMEK.
- Model/version/prompt trace for every AI output.
- Human reviewer identity stored.

## 8. Integrations

v1 API:

- `POST /api/v1/documents`
- `POST /api/v1/documents/{id}/analyze`
- `GET /api/v1/contracts/{id}`
- `GET /api/v1/obligations`
- `PATCH /api/v1/obligations/{id}`
- `POST /api/v1/webhooks`

Webhook events:

- `contract.analyzed`
- `obligation.created`
- `obligation.due_soon`
- `obligation.overdue`
- `risk.high_detected`
- `review.required`

Connectors:

- Hujjat.uz
- 1C
- DiDox
- Google Drive/SharePoint later

## 9. 90-day execution plan

### Days 1-14: foundation

- Add Postgres.
- Add file storage.
- Add auth/RBAC.
- Persist contracts/obligations/tasks.
- Add AI run logs.
- Add golden JSON schema.

### Days 15-30: dataset

- Collect 200-300 real or synthetic contracts.
- Label 50 manually with senior review.
- Build evaluation script.
- Create baseline score for current Gemini prompt.

### Days 31-45: RAG

- Build law/template knowledge ingestion.
- Add embeddings/vector store.
- Add retrieval into AI prompt.
- Measure improvement on benchmark.

### Days 46-60: validation

- Add deterministic validators:
  - dates.
  - money.
  - currency.
  - party names.
  - contradiction detection.
- Add citation verification.
- Add human correction UI.

### Days 61-75: fine-tuning

- Prepare JSONL tuning dataset.
- Run small supervised tuning job.
- Compare base model vs tuned model.
- Promote only if benchmark improves.

### Days 76-90: enterprise readiness

- Audit logs.
- Webhooks.
- API docs.
- Admin dashboard.
- Security review.
- Integration stub for Hujjat.uz/1C/DiDox.

## 10. First practical homework

1. Create 30 PDF contracts in Uzbek/Russian/English.
2. For each PDF, create golden JSON.
3. Run current `/api/analyze-pdf`.
4. Compare AI JSON vs golden JSON.
5. Record failures:
   - missed obligation.
   - wrong date.
   - wrong amount.
   - wrong page.
   - wrong risk severity.
6. Improve prompt only after errors are categorized.

No tuning before measurement.
