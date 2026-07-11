# LegalAI Loyihasi: Yakuniy Holat, ML/LLM Xulosalar Va Keyingi Bosqichlar

Sana: 2026-07-06  
Loyiha papkasi: `/Users/amirxon/Desktop/legalAI`  
Server: `http://localhost:5174/`  
Asosiy model: `gemini-2.5-pro`  
Fallback modellar: `gemini-3.5-flash`, `gemini-2.5-flash`, `gemini-2.5-flash-lite`

## 1. Qisqa Yakuniy Xulosa

Bu loyiha hozir oddiy PDF upload demo emas. Loyiha quyidagi professional poydevorga keltirildi:

- PDF-only legal document analysis.
- Vertex AI pullik service account orqali `gemini-2.5-pro`.
- Uzbek, Russian, English va mixed-language PDF tahlili.
- Contract fields, risks, obligations, review queue, alerts, confidence score, page citation.
- Frontend routing va har sidebar bo'limi alohida page.
- Backend modular architecture.
- ML/LLM evaluation pipeline.
- Golden dataset va expected JSON.
- RAG knowledge base.
- Client qo'llanmalarini yuklash uchun `Bilim bazasi` sahifasi.
- UI usability yaxshilandi: har sahifada maqsad, holat va keyingi ish bir qarashda ko'rinadi.

Eng muhim natija: loyiha endi "AI javob berdi" darajasida emas, balki "AI javobini o'lchaymiz, taqqoslaymiz, yaxshilaymiz" darajasiga o'tdi.

## 2. Hozir Loyiha Qanday Ishlaydi

### 2.1 PDF AI Tahlil Oqimi

1. User `AI tahlil` sahifasida PDF yuklaydi.
2. Frontend faylni `/api/analyze-pdf` endpointiga yuboradi.
3. Backend PDFni memory upload orqali qabul qiladi.
4. Backend `legalPrompt.mjs` orqali qat'iy JSON schema prompt yaratadi.
5. Backend `knowledge/corpus` va `knowledge/uploads` ichidagi RAG contextni olib promptga qo'shadi.
6. Vertex AI PDFni o'qiydi.
7. AI structured JSON qaytaradi.
8. Backend `normalizeLegalAnalysis.mjs` orqali javobni barqaror API schema holatiga keltiradi.
9. Frontend natijani ko'rsatadi:
   - document type,
   - counterparty,
   - value,
   - term,
   - governing law,
   - fields,
   - risks,
   - obligations,
   - review queue,
   - alerts.
10. User natijani reyestrga saqlaydi.
11. Saqlangandan keyin shartnoma, majburiyat, task, template va analytics sahifalarida data paydo bo'ladi.

### 2.2 Bilim Bazasi / RAG Oqimi

1. User `Bilim bazasi` sahifasiga kiradi.
2. Client o'z biznesiga tegishli hujjat yuklaydi:
   - PDF,
   - TXT,
   - MD,
   - CSV,
   - JSON.
3. Bu hujjatlar bo'lishi mumkin:
   - Bitrix scriptlari,
   - amoCRM pipeline qoidalari,
   - savdo operator qo'llanmasi,
   - approval matrix,
   - shartnoma checklist,
   - risk playbook,
   - ichki compliance policy,
   - qonuniy qo'llanma.
4. Backend `/api/knowledge/upload` orqali faylni qabul qiladi.
5. Vertex AI hujjatni "business knowledge playbook" formatiga aylantiradi.
6. Natija `knowledge/uploads/` ichida markdown sifatida saqlanadi.
7. RAG cache yangilanadi.
8. Keyingi PDF tahlilda AI shu client qoidasiga tayanadi.

Bu qism juda muhim, chunki har biznes uchun AI qarori umumiy taxmin emas, o'sha biznesning ichki qoidalari asosida chiqadi.

### 2.3 ML Evaluation Oqimi

1. `datasets/golden/cases.json` ichida test case ro'yxati turadi.
2. Har case uchun expected JSON bor.
3. `scripts/evaluate-analysis.mjs` PDFni APIga yuboradi.
4. AI javobi expected JSON bilan solishtiriladi.
5. Score chiqadi:
   - document score,
   - field score,
   - risk score,
   - obligation score,
   - review queue score,
   - alert score,
   - page citation score.
6. Report `reports/evaluation/` ichiga yoziladi.

Bu pipeline orqali prompt yoki RAG o'zgarganda AI yaxshilandimi yoki yomonlashdimi aniq ko'rinadi.

## 3. Qilingan Ishlar Birma-Bir

### 3.1 Frontend Architecture

Asosiy frontend strukturasi:

```text
src/
  app/
    AppShell.tsx
    navigation.ts
  components/
    ui.tsx
  features/
    legal/
      LegalWorkspaceRouter.tsx
      api.ts
      domain.ts
      types.ts
      pages/
        LegalWorkspacePages.tsx
      state/
        useLegalWorkspace.ts
  main.tsx
  styles.css
```

Nima yaxshilandi:

- `App.tsx` endi faqat app composition va browser routing uchun javob beradi.
- `AppShell.tsx` sidebar, topbar, global search va layoutni boshqaradi.
- `navigation.ts` barcha sidebar route va label konfiguratsiyasini saqlaydi.
- `useLegalWorkspace.ts` legal state va biznes actionlarni boshqaradi.
- `LegalWorkspaceRouter.tsx` section bo'yicha kerakli page componentni ko'rsatadi.
- `LegalWorkspacePages.tsx` sahifalarning UI componentlarini saqlaydi.

### 3.2 Sidebar Pages

Hozirgi sahifalar:

```text
/dashboard       -> Boshqaruv
/ai-tahlil       -> AI tahlil
/shartnomalar    -> Shartnomalar
/majburiyatlar   -> Majburiyatlar
/vazifalar       -> Vazifalar
/taqqoslash      -> Taqqoslash
/shablonlar      -> Shablonlar
/bilim-bazasi    -> Bilim bazasi
/analytics       -> Analitika
/staff-lab       -> AI Lab
/kotib-tahlili   -> Tizim tahlili
```

Har bir sahifa alohida route sifatida ishlaydi. Sahifadan sahifaga o'tganda ma'lumotlar o'chmaydi. Faqat browser refresh bo'lsa frontend memory tozalanadi.

### 3.3 Backend Architecture

Backend strukturasi:

```text
server/
  api/
    createHttpApp.mjs
    middleware/
      errorHandler.mjs
      knowledgeUpload.mjs
      pdfUpload.mjs
  modules/
    health/
      healthRouter.mjs
    legal-analysis/
      analysisController.mjs
      analysisRouter.mjs
      legalPrompt.mjs
      normalizeLegalAnalysis.mjs
      vertexLegalService.mjs
    knowledge/
      knowledgeController.mjs
      knowledgePrompt.mjs
      knowledgeRouter.mjs
      knowledgeService.mjs
      legalKnowledgeBase.mjs
  platform/
    config/
      runtime.mjs
server.mjs
```

Nima yaxshilandi:

- Route fayllari endpoint wiring qiladi.
- Controller fayllari request/response orchestration qiladi.
- Service fayllari Vertex AI yoki knowledge logic bilan ishlaydi.
- Runtime config alohida joyda.
- PDF upload va knowledge upload middleware alohida.
- Error handler Vertex, credential, quota, PDF format xatolarini userga tushunarli qaytaradi.

### 3.4 Vertex AI Ulanishi

Credential path:

```text
/Users/amirxon/Desktop/big-quanta-469517-h6-55280c39d520.json
```

Server bu credential orqali ishlaydi. Health endpointda project va model status ko'rinadi:

```text
GET /api/health
```

Asosiy model order:

```text
gemini-2.5-pro
gemini-3.5-flash
gemini-2.5-flash
gemini-2.5-flash-lite
```

Agar bir model access, region, JSON yoki availability xatosi bersa, backend keyingi modelga fallback qiladi.

### 3.5 Bilim Bazasi

System knowledge corpus:

```text
knowledge/corpus/
  contract-risk-taxonomy.md
  legal-extraction-playbook.md
  obligation-alert-taxonomy.md
```

Client uploadlar:

```text
knowledge/uploads/
```

`knowledge/uploads/` `.gitignore` qilingan, chunki bu yerda client maxfiy hujjatlari bo'lishi mumkin.

Knowledge API:

```text
GET    /api/knowledge
POST   /api/knowledge/upload
DELETE /api/knowledge/:id
```

### 3.6 ML/LLM Evaluation

Qo'shilgan fayllar:

```text
datasets/golden/cases.json
datasets/golden/legalai-full-system-test.expected.json
scripts/evaluate-analysis.mjs
docs/ml/ML_LLM_WORKFLOW.md
```

Ishlatish:

```bash
npm run eval:ml
```

Offline saved response uchun:

```bash
npm run eval:ml:actual
```

So'nggi live evaluation natijasi:

```text
Overall: 86.5%
Document: 100%
Risks: 93.6%
Obligations: 99.2%
Review queue: 53.3%
Alerts: 66.1%
Model: gemini-2.5-pro
```

Xulosa:

- Document, risk va obligation extraction kuchli.
- Review queue va alerts hali kuchaytirilishi kerak.
- Bu production AI uchun to'g'ri baseline.

### 3.7 UI/UX Yaxshilanishi

Qo'shilgan asosiy UI pattern:

```text
PageIntro
```

Har sahifa tepasida:

- sahifa vazifasi,
- qisqa tushuntirish,
- hozirgi metrikalar,
- action signallari ko'rinadi.

UI tamoyillari:

- User birinchi ko'rishda sahifa vazifasini tushunishi kerak.
- Gorizontal scroll minimal bo'lishi kerak.
- Mobile layout stacked bo'lishi kerak.
- Technical jargon kamaytirilgan.
- Sidebar label va sahifa matnlari soddalashtirilgan.
- Empty state bor joyda keyingi qadam aniq yozilgan.

## 4. Har Bir Sahifa Nima Qiladi

### 4.1 Boshqaruv

Portfel holatini ko'rsatadi:

- shartnomalar soni,
- faol majburiyatlar,
- kechikkan ishlar,
- AI score,
- yaqin deadline,
- risklar,
- mening ishlarim,
- pipeline holati,
- kontragentlar.

### 4.2 AI Tahlil

Asosiy PDF upload sahifasi:

- faqat PDF qabul qiladi,
- skan PDF va text PDF bilan ishlaydi,
- Uzbek/Russian/English qo'llab-quvvatlanadi,
- fields, risks, obligations, review queue va alerts chiqaradi,
- natijani reyestrga saqlaydi.

### 4.3 Shartnomalar

Saqlangan AI tahlil natijalari:

- hujjat reyestri,
- qidiruv,
- tanlangan shartnoma detail,
- ajratilgan maydonlar,
- risk va obligations bilan bog'lanish.

### 4.4 Majburiyatlar

AI topgan majburiyatlar boshqariladi:

- owner,
- due date,
- status,
- completed,
- archived,
- task yaratish.

### 4.5 Vazifalar

Task kanban:

- kutilmoqda,
- jarayonda,
- bajarildi.

Majburiyat va risklardan task yaratiladi.

### 4.6 Taqqoslash

Reference va candidate matnlar farqini ko'rsatadi:

- payment terms,
- auto-renewal,
- jurisdiction,
- risk impact.

Hozir prototip logic bor. Keyingi bosqichda bu ham Vertex AI bilan PDF-to-PDF comparison bo'lishi kerak.

### 4.7 Shablonlar

Extraction template va field library:

- template yaratish,
- field qo'shish,
- placeholder ko'rish,
- AI extractiondan reusable template yaratish.

### 4.8 Bilim Bazasi

Client-specific RAG:

- qo'llanma yuklash,
- Bitrix/amoCRM script yuklash,
- approval matrix yuklash,
- internal policy yuklash,
- system/client playbooklarni ko'rish,
- client hujjatini o'chirish.

Bu sahifa har bir biznesni o'z qoidalariga moslash uchun eng muhim qism.

### 4.9 Analitika

Boshqaruv analytics:

- risk kategoriyalari,
- majburiyat statuslari,
- workload,
- mas'ullar bo'yicha ochiq ishlar.

### 4.10 AI Lab

AI configuration va staff workflow:

- prompt takliflari,
- reference hujjatlar,
- staging,
- test,
- approve,
- global qilish.

Bu professional productda faqat admin/staff role uchun bo'lishi kerak.

### 4.11 Tizim Tahlili

Kotib Legalga o'xshash system scope tushuntiriladi:

- modul tahlili,
- hujjat amallari,
- terminlar,
- arxitektura izohi.

## 5. Keyingi Bosqichga Chiqish Uchun Nimalar Kerak

### 5.1 Dataset

Kamida:

```text
50 ta test PDF
50 ta expected JSON
```

Optimal:

```text
8 document class x 160 hujjat = 1280 hujjat
```

Har bir hujjat uchun:

- document class,
- contract type,
- fields,
- risks,
- obligations,
- alerts,
- review queue,
- page citation,
- reviewer notes.

### 5.2 Human Review Loop

Production AI uchun user tuzatgan har bir narsa saqlanishi kerak:

- field correction,
- risk severity correction,
- obligation owner correction,
- alert correction,
- false positive,
- missing item.

Bu feedback keyingi golden datasetga qo'shiladi.

### 5.3 Persistent Database

Hozir frontend memory ishlaydi. Production uchun DB kerak:

- PostgreSQL,
- Prisma yoki Drizzle ORM,
- contracts table,
- documents table,
- obligations table,
- tasks table,
- risks table,
- knowledge_documents table,
- evaluation_runs table,
- audit_events table.

### 5.4 File Storage

PDF va client knowledge hujjatlari uchun:

- local disk faqat dev uchun,
- productionda S3/GCS yoki local encrypted storage,
- file hash,
- tenant isolation,
- access control.

### 5.5 Auth/RBAC

Kerakli rolelar:

- Owner,
- Legal,
- Finance,
- Operations,
- Management,
- Staff/Admin,
- Read-only auditor.

Har sahifa va action role bo'yicha cheklanishi kerak.

### 5.6 Real RAG Vector DB

Hozir lightweight text retrieval bor. Optimal holatda:

- chunking pipeline,
- embeddings,
- pgvector yoki Vertex Matching Engine,
- metadata filtering,
- document type filtering,
- language filtering,
- tenant filtering.

### 5.7 Model/Prompt Registry

Har AI run saqlashi kerak:

- model name,
- prompt version,
- knowledge version,
- dataset version,
- processing time,
- score,
- output schema version.

### 5.8 Webhooks Va Integratsiyalar

Keyingi professional integratsiyalar:

- Bitrix,
- amoCRM,
- Hujjat.uz,
- 1C,
- DiDox,
- Telegram/Email alerts,
- Webhook events.

Eventlar:

- obligation.created,
- task.created,
- alert.due_soon,
- contract.high_risk,
- review.required,
- knowledge.updated.

## 6. Eng Optimal Holatga Chiqish Uchun Checklist

### 6.1 Product

- Har sidebar page real backend data bilan ishlasin.
- Dashboard production DBdan metrics olsin.
- Refreshdan keyin ham data saqlansin.
- User role bo'yicha UI actionlar ko'rinsin yoki yashirilsin.
- Audit log har actionni yozsin.

### 6.2 AI

- 200+ annotated PDFs.
- Golden dataset har document class uchun alohida.
- `npm run eval:ml` CI pipelinega qo'shilsin.
- RAG vector DB ulanadi.
- Review queue score 90% dan oshiriladi.
- Alerts score 90% dan oshiriladi.
- Citation accuracy 90% dan oshiriladi.
- Prompt va knowledge versioning qo'shiladi.

### 6.3 Legal Accuracy

- Senior lawyer review jarayoni.
- Risk taxonomy rasmiylashtiriladi.
- Uzbekistan jurisdiction playbook qo'shiladi.
- Contract type bo'yicha alohida playbooklar:
  - service agreement,
  - supply,
  - lease,
  - NDA,
  - employment,
  - finance,
  - addendum.

### 6.4 Security

- Service account key rotate qilinadi.
- `.env` orqali credential path.
- Client uploads encrypted storage.
- Tenant isolation.
- No training on client documents policy.
- Access audit.
- Data retention policy.

Muhim: oldin service account private key chatga yuborilgan. Bu key exposed hisoblanadi. Productionga chiqishdan oldin Google Cloud Console orqali key rotate qilish kerak.

### 6.5 Performance

- Long PDF analysis job queuega o'tkaziladi.
- Sync request o'rniga:
  - POST create job,
  - GET job status,
  - websocket/SSE progress.
- Model fallback latency metrics.
- PDF OCR caching.
- Knowledge retrieval caching.

### 6.6 UI

- Har page uchun loading, empty, error, success state.
- Mobile va desktop manual QA.
- No horizontal overflow.
- Keyboard navigation.
- Screen reader labels.
- User actionlar aniq nomlangan.
- In-app text technical jargon bo'lmasin.

## 7. Ishlatish Commandlari

Dev server:

```bash
npm run dev
```

Build:

```bash
npm run build
```

ML evaluation:

```bash
npm run eval:ml
```

Health:

```bash
curl http://localhost:5174/api/health
```

Knowledge list:

```bash
curl http://localhost:5174/api/knowledge
```

## 8. Hozirgi Muhim Fayllar

Frontend:

```text
src/App.tsx
src/app/AppShell.tsx
src/app/navigation.ts
src/components/ui.tsx
src/features/legal/LegalWorkspaceRouter.tsx
src/features/legal/pages/LegalWorkspacePages.tsx
src/features/legal/state/useLegalWorkspace.ts
src/features/legal/api.ts
src/features/legal/types.ts
src/styles.css
```

Backend:

```text
server.mjs
server/api/createHttpApp.mjs
server/modules/legal-analysis/*
server/modules/knowledge/*
server/platform/config/runtime.mjs
```

ML/RAG:

```text
datasets/golden/*
knowledge/corpus/*
scripts/evaluate-analysis.mjs
docs/ml/ML_LLM_WORKFLOW.md
```

Docs:

```text
docs/ARCHITECTURE.md
docs/PRODUCTION_AI_ROADMAP.md
docs/FINAL_PROJECT_HANDOVER_UZ.md
TEST_GUIDE.md
```

## 9. Yakuniy Texnik Holat

Oxirgi tekshiruvlar:

- `npm run build` muvaffaqiyatli.
- Barcha sidebar route 200 qaytdi.
- `/api/health` Vertex va knowledge status qaytaryapti.
- `/api/knowledge` system playbooklarni qaytaryapti.
- Knowledge upload smoke test 200 qaytargan.
- Test upload o'chirilgan, `knowledge/uploads` toza manifest bilan qolgan.

## 10. Yakuniy Strategik Xulosa

Bu loyiha hozir professional Legal AI ekotizimning poydevoriga ega:

- legal PDF tahlil,
- biznesga mos RAG,
- ML evaluation,
- structured extraction,
- UI routing,
- knowledge upload,
- model fallback,
- modular backend.

Keyingi katta sakrash DB, auth, real dataset, vector RAG va human review loop bilan bo'ladi.

Eng optimal yo'l:

```text
DB + Auth + File Storage
-> Real Golden Dataset
-> RAG Vector DB
-> Human Review Feedback
-> Evaluation CI
-> Fine-tuning
-> Integrations/Webhooks
-> Enterprise Security
```

Fine-tuning eng oxirgi bosqichlardan biri bo'lishi kerak. Oldin dataset, RAG va evaluation mukammal bo'lishi kerak.
