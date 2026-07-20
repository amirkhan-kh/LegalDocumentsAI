# LegalAI Full System Test Guide

Test PDF:

```text
/Users/amirxon/Desktop/LegalAI_Full_System_Test_Contract.pdf
```

## 1. Serverni tekshirish

```bash
npm run dev
```

Brauzer:

```text
http://localhost:5174/login
```

`admin` / `legal123` bilan kiring, xavfsizlik siyosatini tasdiqlang va ishchi sessiyani boshlang.

Health:

```bash
curl http://localhost:5174/api/health
```

Kutiladi:

- `ok: true`
- `pdfOnly: true`
- `maxPdfBytes: 52428800`
- `authRequired: true`
- `languages: ["uz", "ru", "en"]`
- `vertex.models: ["gemini-2.5-pro"]`
- `vertex.timeoutSeconds: 60`
- `vertex.proThinkingBudget: 128`
- `vertex.runtime.gcsConfigured: true`
- `vertex.runtime.gcsAvailable: true`
- `vertex.runtime.inlineFallbackEnabled: false`
- `vertex.activeModel` PDF tahlildan keyin `gemini-2.5-pro` bo'ladi.
- `vertex.activeTransport` PDF tahlildan keyin `gcs` bo'ladi.

## 2. Routing tekshiruvi

Har bir route alohida ochilishi kerak:

```text
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

Refresh qilinganda shu sahifa qayta ochilishi kerak. Sidebar bosilganda URL o'zgarishi kerak.

Sidebar toggle orqali keng va ixcham holatlarni, mobil o'lchamda drawer menyuni tekshiring. `UZ`, `RU`, `EN` tugmalari login hamda workspace matnlarini almashtirishi kerak.

## 3. AI tahlil

1. `/ai-tahlil` sahifasiga o'ting.
2. `LegalAI_Full_System_Test_Contract.pdf` faylini tanlang.
3. `PDF tahlilni boshlash` tugmasini bosing.
4. Tahlil natijasida quyidagilar chiqishini tekshiring:
   - model nomi `gemini-2.5-pro`;
   - `processing_ms <= 60000`;
   - language `MIXED`;
   - contract class/type;
   - fields;
   - risks;
   - obligations;
   - alerts;
   - confidence va source/page citation.

Kutilgan markerlar:

```text
Nova LegalTech Solutions Ltd.
UZS 1,250,000,000
RISK-AUTO-RENEWAL-60
OVERDUE-ISO-CERTIFICATE
TEMPLATE-FIELD-LIBRARY-COMPLETE
STAFF-LAB-AUTHORING-PROPOSAL
```

PDF upload limiti **50 MiB inclusive** (`52,428,800` byte): aynan limitdagi haqiqiy PDF qabul qilinishi, `52,428,801` byte fayl esa HTTP `413` hamda `LIMIT_FILE_SIZE` yoki `PDF_TOO_LARGE` kodi qaytarishi kerak. `.pdf` nomli oddiy text yoki EOF'i uzilgan fayl HTTP `400` va `INVALID_PDF` qaytarishi kerak.

Tahlil paytida health'dagi `vertex.runtime.activeAnalyses` oshadi. Tugagach `vertex.activeTransport: "gcs"` va bucket'ning `temporary/` prefiksida ushbu so'rovdan qolgan object yo'qligini tekshiring. GCS ishlamasa inline fallback faqat compatibility rejimi hisoblanadi.

## 4. Saqlashdan keyingi tekshiruv

AI natija chiqqandan keyin `Reyestrga saqlash` tugmasini bosing.

Keyin quyidagilarni tekshiring:

- `/shartnomalar`: contract registry ichida `LEGALAI FULL FEATURE TEST CONTRACT` ko'rinadi.
- `/majburiyatlar`: active obligations bor, owner va due date bilan.
- `/vazifalar`: kanban ichida task kartalar bor. `Vazifa yo'q` qolmasligi kerak.
- `/shablonlar`: staging template va extracted fields bor.
- `/analytics`: risk/status/workload barlari non-zero.
- `/staff-lab`: testing proposal paydo bo'ladi.
- `/dashboard`: KPI, risklar, deadline va tasklar non-empty bo'ladi.

## 5. Global search

Topbardagi qidiruvda quyidagilarni izlang:

```text
Nova LegalTech
1250000000
auto-renewal
OVERDUE-ISO-CERTIFICATE
RISK-BROAD-INDEMNITY
```

Natija bosilganda tegishli sahifaga o'tishi kerak.

## 6. Majburiyat va vazifa amallari

1. `/majburiyatlar` sahifasida owner selectni o'zgartiring.
2. Check icon bilan bittasini `Bajarildi` qiling.
3. Plus icon bilan majburiyatdan task yarating.
4. Archive icon bilan arxivlang.
5. `/vazifalar` sahifasida taskni `Kutilmoqda -> Jarayonda -> Bajarildi` qiling.

## 7. Taqqoslash testi

`/taqqoslash` sahifasida:

Reference:

```text
Payment must be made within 30 calendar days. Renewal requires a separate written agreement. Governing law is the Republic of Uzbekistan.
```

Candidate:

```text
Payment may be made within 45 calendar days. The agreement will auto renew unless notice is sent 60 days before expiry. Governing law is English law.
```

Kutiladi:

- 45 days payment farqi;
- auto-renewal high risk;
- English law high risk.

## 8. Staff Lab testi

1. `/staff-lab` sahifasiga o'ting.
2. `Reference hujjatlar yuklash` orqali shu PDFni yana tanlang.
3. Proposal yaratiladi.
4. `Test`, `Approve`, `Promote`, `Discard` tugmalarini tekshiring.

## 9. Refresh state qoidasi

- Sidebar sahifalari orasida o'tganda data o'chmasligi kerak.
- Brauzer refresh qilinganda data tozalanishi mumkin. Bu hozirgi talab bo'yicha to'g'ri.

## 10. Terminal dalil testi

```bash
npm run build
npm audit --audit-level=moderate
npm run eval:ml
```

Kutiladi:

- HTTP 200;
- evaluator `quality`, `model`, `transport`, `latency` gate'lari `PASS`;
- `model=gemini-2.5-pro`;
- `transport=gcs`;
- `processingMs <= 60000`;
- `document_class: contract`;
- `language: mixed`;
- fields, risks, obligations, review_queue, alerts qaytadi.

`60 s` hard timeout muvaffaqiyatli tahlilning PayGo latency kafolati emas. Testni turli hajm, sahifa soni va scanned PDF'lar bilan takrorlab p50/p95 o'lchang; evaluator reportlari `reports/evaluation/` ichida sifat, model, server processing va API request vaqtini saqlaydi.
