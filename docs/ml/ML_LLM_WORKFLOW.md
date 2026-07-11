# ML/LLM Workflow

Bu papka LegalAI loyihasida aniqlikni o'lchash va yaxshilash uchun boshlandi. Maqsad: PDF extraction sifatini model nomi bilan emas, golden dataset va regression test bilan isbotlash.

## 1. Hozir qo'shilgan qismlar

- `datasets/golden/cases.json` - evaluation case manifest.
- `datasets/golden/*.expected.json` - har bir PDF uchun kutiladigan legal extraction spec.
- `scripts/evaluate-analysis.mjs` - AI natijasini golden spec bilan solishtiradigan evaluator.
- `knowledge/corpus/*.md` - RAG/legal playbook corpus.
- `server/modules/knowledge/legalKnowledgeBase.mjs` - backend prompt uchun lightweight retrieval.
- `/bilim-bazasi` - client qo'llanmalari, CRM scriptlari, policy va playbooklarni yuklash sahifasi.
- `/api/knowledge` - knowledge list/upload/delete API.
- `/api/health` - knowledge corpus holatini ham ko'rsatadi.

## 2. Ishlatish

Server ishlayotgan bo'lishi kerak:

```bash
npm run dev
```

Golden evaluation:

```bash
npm run eval:ml
```

Natija `reports/evaluation/` ichiga JSON report sifatida yoziladi. Console quyidagilarni ko'rsatadi:

- umumiy score;
- model nomi;
- document score;
- minimum count score;
- fields/risk/obligation/review_queue/alerts score.

## 3. Golden dataset qo'shish qoidasi

## 3. Client Knowledge / RAG qo'shish

Client har bir biznes uchun quyidagi hujjatlarni yuklaydi:

- Bitrix yoki amoCRM pipeline qoidalari.
- Savdo operator scriptlari.
- Approval matrix va vakolat limitlari.
- Shartnoma checklistlari.
- To'lov, chegirma, jarima, kredit yoki risk policy.
- Ichki yuridik qo'llanmalar va compliance playbooklar.

UI:

```text
/bilim-bazasi
```

Backend:

```text
GET    /api/knowledge
POST   /api/knowledge/upload
DELETE /api/knowledge/:id
```

Yuklangan hujjat Vertex orqali decision-rule playbookga aylantiriladi va `knowledge/uploads/` ichiga saqlanadi. Bu papka `.gitignore` qilingan, chunki client hujjatlari maxfiy bo'lishi mumkin.

## 4. Golden dataset qo'shish qoidasi

Yangi PDF qo'shish:

1. PDFni xavfsiz test fixture sifatida joylashtiring yoki absolute path bilan ko'rsating.
2. `datasets/golden/cases.json` ichiga case qo'shing.
3. Shu case uchun `*.expected.json` yozing.
4. `npm run eval:ml` bilan regression tekshiring.

Expected JSON model javobini ko'chirish emas. U reviewer/yurist tasdiqlagan kutiladigan haqiqat bo'lishi kerak.

## 5. Accuracy maqsadlari

Boshlang'ich threshold:

```text
overall >= 80%
```

Productionga yaqinlashganda:

```text
document >= 98%
fields >= 95%
risks >= 92%
obligations >= 90%
page citation >= 90%
alerts >= 90%
```

## 6. Keyingi bosqichlar

- Real yurist annotated 50-200 ta PDFdan validation set qilish.
- Model/prompt versiyasini reportga yozish.
- Human review tuzatishlarini golden datasetga qaytarish.
- Vector DB qo'shish: pgvector, Vertex Matching Engine yoki boshqa managed vector store.
- Fine-tuningni faqat evaluation barqarorlashgandan keyin boshlash.
