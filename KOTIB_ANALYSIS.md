# Kotib Legal tahlili va alternativa scope

Manba: https://legal.kotib.ai/ ommaviy SPA sahifasi, uning frontend bundle/chunk nomlari, route/API izlari va UI matnlari. Backend kodi ko'rinmaydi, shuning uchun serverdagi AI promptlar va model pipeline bo'yicha ayrim qismlar frontend dalillaridan inferensiya qilingan.

## Mahsulot nima qiladi

Kotib Legal oddiy hujjat chat-boti emas. U yuridik hujjatlarni qabul qilish, AI orqali tahlil qilish, risk va majburiyatlarni ajratish, keyin ularni shartnoma reyestri, vazifa menejeri, deadline queue va analytics ichida boshqarishga mo'ljallangan SaaS platforma.

Asosiy va'da landing sahifada shunday: PDF shartnoma yuklanadi, AI majburiyatlar, deadline va risklarni soniyalar ichida ajratadi; Uzbek, Russian, English qo'llanadi; scanned PDF uchun OCR nazarda tutilgan.

## Ishlash prinsipi

1. Hujjat yuklanadi.
   - Ommaviy landing PDF-only deb aytadi, app ichki upload UI esa PDF, DOC, DOCX ni ham qabul qiladi.
   - File limit matnlarda 20 MB sifatida ko'rinadi.

2. Klassifikatsiya.
   - AI hujjat classini aniqlaydi: contract yoki non-contract.
   - Keyin domain/type va sub-type aniqlanadi.
   - Manual mode ham bor: foydalanuvchi sub-type tanlay oladi.

3. Extraction.
   - Tomonlar, kontragent, qiymat, muddat, governing law, bank rekvizitlari kabi maydonlar ajratiladi.
   - Har bir maydonda confidence score va source/citation bo'lishi kutiladi.
   - Status pipeline: uploaded/pending -> classifying -> extracting -> done yoki failed/stalled.

4. Review.
   - Inson past confidence, noto'g'ri type, risk va majburiyatlarni tekshiradi.
   - "Wrong type?", "Pick sub-type manually", "Re-run extraction", "Save selection" kabi oqimlar bor.
   - Foydalanuvchi AI topgan majburiyatlardan qaysilarini saqlashni tanlaydi.

5. Operatsion boshqaruv.
   - Saqlangan majburiyatlar owner, deadline, status bilan navbatga tushadi.
   - Ulardan task yaratiladi, reminder/notification va audit izlari yuritiladi.
   - Shartnoma reyestri, kontragentlar, xodimlar, bo'limlar va analytics bilan bog'lanadi.

## Qanday hujjatlar bilan ishlaydi

- PDF shartnomalar, shu jumladan scanned PDF.
- DOC/DOCX hujjatlar app ichki upload va comparison modullarida ko'rinadi.
- Word template fayllari field library/global templates uchun ishlatiladi.
- Contract va non-contract klasslari bor, lekin asosiy optimizatsiya shartnomalar uchun.
- Tillar: Uzbek Latin/Cyrillic, Russian, English.

## Hujjat ustida bajara oladigan amallar

- Upload va klassifikatsiya.
- AI extraction: dynamic fields, risk findings, obligations.
- Confidence va source citation ko'rsatish.
- PDF/DOCX viewer orqali hujjatni ko'rish va highlight.
- Skanerlangan hujjatda highlight bo'lmasa, taxminiy sahifaga o'tish.
- Manual sub-type override.
- Re-extract/re-run extraction.
- Selected obligations ni saqlash, qolganlarini o'chirish.
- Shartnoma ko'rish, tahrirlash, render-content, render-pdf.
- Obligation archive/unarchive.
- Contract bo'yicha obligations ni keep qilish.
- Ikki hujjatni comparison qilish: reference va candidate.
- Template fieldlarni ajratish va Word shablonga joylashtirish.

## Asosiy modullar

- Dashboard: deadline, AI risk, open tasks, portfolio health.
- Review/Analyze: hujjat yuklash va AI tahlil.
- Contracts: shartnoma reyestri, analyzed/internal contracts.
- Obligations: majburiyatlar, owner, due date, recurring/one-time, status.
- Tasks: task-management, files, status.
- Counterparties: kontragent profili, bank va registration ma'lumotlari.
- Employees/Departments: kompaniya ichki strukturasi.
- Notifications: o'qish, mark all read.
- Analytics: AI risk, common errors, breach reasons, signing time, workload.
- Field Library: reusable field categories/types/groups.
- Global Templates: company-wide template catalog.
- Comparison: reference/candidate hujjatlarni taqqoslash.
- Staff panel: AI config, document templates, demo requests, staging/testing.
- HQ: branches va activity/audit.

## API izlari

Frontend bundle ichida quyidagi endpoint oilalari ko'rinadi:

- `/api/v1/users/auth/sign-in`, `/refresh`, `/profile`, `/change-password`
- `/api/v1/ai/contract-analysis/analyze-v2`
- `/api/v1/ai/contract-analysis/{id}/reextract`
- `/api/v1/contracts/contracts`, `/obligations`, `/contract-types`, `/contract-categories`
- `/api/v1/task-management/tasks`
- `/api/v1/templates/field-categories`, `/field-types`, `/field-groups`
- `/api/v1/analytics/*`
- `/api/v1/audit/events`
- `/api/v1/management/companies/*`
- `/api/v1/ai/authoring/staging/*`
- `/api/v1/waitlist`

## Vazifalar ma'nolari

- Classification: hujjat qaysi domain/sub-typega tegishli ekanini aniqlash.
- Extraction: yuridik matndan strukturali ma'lumot chiqarish.
- Obligation: tomon bajarishi kerak bo'lgan majburiyat, deadline va owner bilan.
- Risk finding: yuridik yoki operatsion xavf, masalan auto-renewal, penalty cap, missing clause.
- Confidence: AI ishonch darajasi; past bo'lsa inson review qiladi.
- Citation: natija qaysi band yoki sahifadan chiqqanini ko'rsatish.
- Re-extract: xuddi shu hujjatni qayta AI tahlildan o'tkazish.
- Field Library: shartnomalarda qayta ishlatiladigan dynamic maydonlar katalogi.
- Global Template: barcha kompaniya/workspace uchun ishlatiladigan shablon.
- Staging: staff sinayotgan, hali global mijozlarga chiqmagan AI config/template.
- Promote: sinovdan o'tgan config/template ni global katalogga chiqarish.

## Shu folderdagi alternativa

Bu folderda qurilgan alternativa `LegalAI Workspace` deb nomlangan. Hozirgi versiyada Node API orqali Google Vertex AI ulanadi va upload oqimi PDF-only qilingan:

- PDF-only hujjat yuklash.
- O'zbek lotin/kiril, rus va ingliz tilidagi PDFlar.
- Skan PDF uchun multimodal document input.
- Vertex AI orqali klassifikatsiya va extraction.
- Structured JSON: maydonlar, risklar, majburiyatlar, review queue, alertlar.
- Page citation va confidence score.
- Shartnoma reyestri.
- Majburiyatlar va vazifalar.
- Reference/candidate comparison.
- Field library va template placeholder.
- Analytics.
- Staff staging/promote oqimi.
- Alohida "Kotib tahlili" sahifasi.

Keyingi production qatlamlari:

- Auth, file storage, contract/obligation/task CRUD.
- PDF storage va audit trail.
- LLM pipeline: classify -> extract -> validate -> cite -> review.
- Queue: long-running jobs va polling.
- Postgres schema: companies, contracts, documents, obligations, tasks, templates, audit.
- RBAC: admin, legal user, employee, staff, HQ.
- Security: encryption at rest, tenant isolation, audit trail.
