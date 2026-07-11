# LegalAI Workspace

Kotib Legal konseptiga alternativ lokal app. Frontend + Node API bitta serverda ishlaydi va PDF hujjatlarni Google Vertex AI orqali tahlil qiladi.

## Ishga tushirish

```bash
npm install
npm run dev
```

Default URL:

```text
http://localhost:5174/dashboard
```

Build tekshirish:

```bash
npm run build
```

## Vertex AI sozlamasi

Server credentialni brauzerga chiqarmaydi. U lokal path orqali o'qiladi:

```text
/Users/amirxon/Desktop/big-quanta-469517-h6-55280c39d520.json
```

Kerak bo'lsa env bilan almashtirish mumkin:

```bash
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
VERTEX_LOCATION=global \
VERTEX_MODEL=gemini-3.5-flash \
npm run dev
```

Default fallback modellar:

```text
gemini-3.5-flash, gemini-2.5-flash, gemini-2.5-pro, gemini-2.5-flash-lite
```

## Ichida nimalar bor

- PDF-only AI hujjat tahlili
- Uzbek, Russian, English hujjatlar
- Scanned PDF uchun multimodal document input
- Structured extraction: maydonlar, risklar, majburiyatlar, page citation, confidence
- Shartnomalar reyestri
- Majburiyatlar va deadline boshqaruvi
- Vazifa kanbani
- Hujjat versiyalarini taqqoslash
- Field Library va template placeholder
- Analytics
- Staff staging/promote paneli
- Kotib Legal bo'yicha tahlil sahifasi

Batafsil product tahlil: [KOTIB_ANALYSIS.md](./KOTIB_ANALYSIS.md)

## Arxitektura

```text
server.mjs                         # bootstrap: config yaratadi, appni listen qiladi
server/
  app.mjs                          # Express app composition, Vite/prod static serving
  config/runtime.mjs               # env, credential path, project, region, model list
  middleware/pdfUpload.mjs         # PDF-only multer upload, 50MB limit
  middleware/errorHandler.mjs      # public API errors, dev debug
  routes/healthRoute.mjs           # GET /api/health
  routes/analysisRoute.mjs         # POST /api/analyze-pdf
  services/legalPrompt.mjs         # legal extraction prompt and JSON contract
  services/vertexLegalService.mjs  # Vertex Gemini client, fallback model handling
  services/normalizeLegalAnalysis.mjs # AI JSON normalization for frontend

src/
  App.tsx                          # page composition and workspace state
  components/ui.tsx                # shared Panel, Badge, EmptyState, chart/KPI UI
  features/legal/api.ts            # frontend API client for PDF analysis
  features/legal/domain.ts         # labels, dates, API-to-UI transform, global search
  features/legal/types.ts          # contract/risk/obligation/task/template types
  styles.css                       # responsive professional workspace styling
```

State qoidasi: sahifadan sahifaga o'tganda ma'lumot o'chmaydi, chunki asosiy workspace state `App.tsx` parent darajasida turadi. Brauzer refresh qilinganda state tozalanadi.

Route qoidasi:

```text
/dashboard
/ai-tahlil
/shartnomalar
/majburiyatlar
/vazifalar
/taqqoslash
/shablonlar
/analytics
/staff-lab
/kotib-tahlili
```

## Sahifalar vazifasi

- Boshqaruv: portfel KPI, yaqin deadline, yuqori risk, ochiq vazifa va kontragent signallari.
- AI tahlil: PDF yuklash, Vertex AI extraction, confidence/page citation, risk, majburiyat, review va alertlarni ko'rish.
- Shartnomalar: saqlangan tahlil natijalari reyestri, kontragent, qiymat, muddat, huquq, maydonlar va bog'langan majburiyatlar.
- Majburiyatlar: owner, due date, status, archive/complete va majburiyatdan vazifa yaratish.
- Vazifalar: pending/progress/done kanban, mas'ul, deadline va priority boshqaruvi.
- Taqqoslash: reference/candidate matnlaridagi to'lov muddati, auto-renewal, yurisdiksiya kabi farqlarni riskka ajratish.
- Shablonlar: staging/global template ro'yxati, yangi shablon yaratish, field placeholder qo'shish.
- Analytics: risk darajalari, majburiyat statuslari va xodimlar workload ko'rinishi.
- Staff Lab: reference PDFdan AI authoring proposal yaratish, test/approve/promote/discard oqimi.
- Kotib tahlili: original Kotib Legal'dan chiqarilgan product scope, terminlar va operatsiyalar izohi.

## Test qoidalari

- Faqat `.pdf` yuklang.
- PDF 50MB dan oshmasin.
- PDF matnli yoki skan bo'lishi mumkin.
- Hujjat o'zbek lotin/kiril, rus yoki ingliz tilida bo'lishi mumkin.
- Natijada har bir muhim maydon confidence va manba bet bilan qaytishi kerak.
- Past confidence yoki noaniq bandlar `review_queue`ga tushadi.
- Renewal, termination, payment, reporting kabi bandlar alertga aylanishi kerak.

## Tekshirish dalillari

Oxirgi lokal tekshiruvlar:

```bash
npm run build
node --check server.mjs
find server -name '*.mjs' -maxdepth 4 -print -exec node --check {} \;
npm audit --audit-level=moderate
curl http://localhost:5174/api/health
curl -F "pdf=@/Users/amirxon/Desktop/LegalAI_Full_Feature_Test_Contract.pdf;type=application/pdf" \
  http://localhost:5174/api/analyze-pdf
```

Real PDF testda `/Users/amirxon/Desktop/LegalAI_Full_System_Test_Contract.pdf` hujjati HTTP 200 qaytardi: `gemini-3.5-flash`, mixed language, contract class, fields, risks, obligations, review queue va alerts.

Qadam-baqadam test: [TEST_GUIDE.md](./TEST_GUIDE.md)
# LegalSalesAI
