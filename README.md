# LegalAI Workspace

Legal hujjatlarni Google Vertex AI yordamida tahlil qilish, risk va majburiyatlarni boshqarish uchun React + Express workspace.

## Ishga tushirish

```bash
npm install
npm run dev
```

Ilova `http://localhost:5174/login` manzilida ochiladi.

Default lokal administrator:

```text
Login: admin
Parol: legal123
```

Login ikki bosqichli: credential tekshiruvi va himoyalangan ishchi sessiyani tasdiqlash. API `HttpOnly` cookie, CSRF token, user-agent binding, urinish limiti va vaqtinchalik bloklash bilan himoyalangan.

Production uchun default ma'lumotlarni env orqali albatta almashtiring:

```bash
LEGALAI_ADMIN_USER=admin \
LEGALAI_ADMIN_PASSWORD='strong-secret' \
LEGALAI_SESSION_TTL_MS=28800000 \
npm start
```

## Vertex AI

Server credentialni frontendga bermaydi. Autentifikatsiya ustuvorligi:

1. `GOOGLE_APPLICATION_CREDENTIALS` orqali service account.
2. `~/.config/gcloud/application_default_credentials.json` orqali Application Default Credentials.
3. Google Cloud runtime ichida workload identity/metadata credential.

```bash
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
GOOGLE_CLOUD_PROJECT=my-project \
VERTEX_LOCATION=global \
VERTEX_MODEL=gemini-2.5-pro \
VERTEX_PDF_GCS_BUCKET=my-private-legalai-pdf \
VERTEX_ANALYSIS_TIMEOUT_MS=60000 \
VERTEX_PRO_THINKING_BUDGET=128 \
VERTEX_MAX_OUTPUT_TOKENS=8192 \
VERTEX_MAX_CONCURRENT_ANALYSES=2 \
npm run dev
```

Default model:

```text
gemini-2.5-pro
```

`VERTEX_MODELS` bilan vergul orqali bir nechta model berish mumkin, ammo production default faqat Gemini 2.5 Pro. Ishlagan model health va tahlil javobida ko'rsatiladi. Model mavjudligi Vertex loyihasidagi region, quota va ruxsatlarga bog'liq.

PDF odatiy oqimda serverning yopiq vaqtinchalik diskiga yoziladi, private Google Cloud Storage bucket'iga yuklanadi va Vertex'ga `fileData.fileUri` (`gs://...`) sifatida beriladi. So'rov tugagach lokal fayl va GCS object o'chiriladi; bucket'da `temporary/` objectlar uchun lifecycle cleanup ham bo'lishi tavsiya etiladi. Runtime service account bucket'da object yaratish/o'chirish, Vertex AI service agent esa object o'qish huquqiga ega bo'lishi kerak.

`VERTEX_PDF_GCS_BUCKET` berilmasa, default bucket nomi `${GOOGLE_CLOUD_PROJECT}-legalai-pdf`. Inline fallback default holatda o'chiq. Faqat compatibility uchun `VERTEX_ALLOW_INLINE_PDF_FALLBACK=true` berilsa ham u `VERTEX_INLINE_PDF_FALLBACK_MAX_BYTES` bilan cheklangan va 5 MiB dan katta faylni base64 xotiraga yuklamaydi.

GCS upload cancellable stream bilan absolute deadline ichida bajariladi. Temporary bucket private, public-access-prevention yoqilgan, soft delete o'chirilgan va `temporary/` prefiksida bir kunlik lifecycle cleanup mavjud bo'lishi kerak.

PDF limiti **50 MiB inclusive**, ya'ni `52,428,800` byte. Server `.pdf` kengaytma/MIME bilan birga `%PDF-` header va `%%EOF` trailer'ni tekshiradi. `MAX_PDF_BYTES` bilan limitni o'zgartirish mumkin.

Gemini Pro pipeline uchun absolute hard timeout default `60,000 ms`; frontend tarmoq timeouti `70 s`. `40–60 s` muvaffaqiyatli javob maqsadi, lekin PayGo Vertex'da qat'iy latency kafolati emas: sahifa soni, scan/OCR, region, quota va yuklama natijaga ta'sir qiladi. Production SLA uchun real hujjatlar korpusida p50/p95 benchmark va zarur bo'lsa Provisioned Throughput rejalashtirilishi kerak. Timeout serverning kutishini cheklaydi, ammo provider tomonida boshlangan hisoblash darhol to'xtaganini kafolatlamaydi.

## Mahsulot imkoniyatlari

- Aviora uslubidagi oq panel, yengil border/shadow, purple–pink–cyan gradient va responsive layout.
- Desktopda yig'iladigan sidebar, mobil drawer, global qidiruv va sessiya profili.
- Interfeys uchun `UZ`, `RU`, `EN`; hujjat tahlili uchun o'zbek, rus va ingliz tillari.
- PDF-only multimodal tahlil, jumladan scanned PDF.
- Structured extraction: maydon, risk, majburiyat, page citation va confidence.
- Shartnoma reyestri, obligation/deadline nazorati va vazifa kanbani.
- Hujjat versiyalarini taqqoslash, Field Library va template placeholder.
- Client knowledge base va system playbooklar bilan RAG grounding.
- Analytics, AI Lab va tizim tahlili sahifalari.

## Arxitektura

```text
server.mjs
server/
  api/createHttpApp.mjs
  api/middleware/
  modules/auth/
  modules/health/
  modules/knowledge/
  modules/legal-analysis/
  platform/config/runtime.mjs
src/
  app/AppShell.tsx
  app/i18n.tsx
  components/ui.tsx
  features/auth/
  features/legal/
  styles.css
scripts/evaluate-analysis.mjs
```

Auth route'lari public, `/api/health` public diagnostika uchun ochiq, qolgan barcha `/api` route'lari sessiya bilan himoyalangan. `POST`, `PUT`, `PATCH` va `DELETE` so'rovlari CSRF token talab qiladi.

## Route'lar

```text
/login
/dashboard
/ai-tahlil
/shartnomalar
/majburiyatlar
/vazifalar
/taqqoslash
/shablonlar
/bilim-bazasi
/analytics
/staff-lab
/kotib-tahlili
```

Workspace state route almashtirilganda saqlanadi, browser refresh qilinganda esa in-memory ma'lumotlar tozalanadi. Knowledge base server diskida saqlanadi.

## Tekshirish

```bash
npm run build
npm run dev
curl http://localhost:5174/api/health
```

ML evaluator serverga ikki bosqichli auth orqali kiradi va default holda to'rt gate'ni tekshiradi: sifat `>=80%`, model `gemini-2.5-pro`, transport `gcs`, server `processing_ms <= 60000`:

```bash
npm run eval:ml
```

Evaluator uchun alohida credential berish mumkin:

```bash
LEGALAI_EVAL_USER=admin LEGALAI_EVAL_PASSWORD=legal123 npm run eval:ml
```

Batafsil product tahlil: [KOTIB_ANALYSIS.md](./KOTIB_ANALYSIS.md). Test yo'riqnomasi: [TEST_GUIDE.md](./TEST_GUIDE.md).
