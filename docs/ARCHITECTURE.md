# LegalAI Architecture

Bu loyiha Kotib Legalga o'xshash yuridik hujjat operatsion tizimi sifatida quriladi: PDF qabul qilish, Vertex AI orqali extraction, review queue, majburiyatlar, vazifalar, shablonlar, analytics va staff/model improvement workflow.

## Frontend

```
src/
  app/
    AppShell.tsx          # Sidebar, topbar, global search va umumiy layout
    navigation.ts         # Route mapping va sidebar konfiguratsiyasi
  components/
    ui.tsx                # Qayta ishlatiladigan UI primitive komponentlar
  features/
    legal/
      LegalWorkspaceRouter.tsx
      api.ts              # Backend API client
      domain.ts           # Frontend domain transform, labels, search helpers
      types.ts            # Contract, obligation, task, template type contracts
      pages/
        LegalWorkspacePages.tsx
      state/
        useLegalWorkspace.ts
  main.tsx
  styles.css
```

Frontend qoidalari:
- `App.tsx` faqat composition va browser history state uchun javob beradi.
- `app/` faqat global layout va navigation uchun ishlatiladi.
- `features/legal/state/` ichida legal workspace state va biznes actionlar turadi.
- `features/legal/pages/` sahifalar UI va user interaction uchun javob beradi.
- Backenddan keladigan schema `features/legal/api.ts` va `domain.ts` orqali frontend modelga aylanadi.
- Sidebar sahifalari alohida URLga ega: `/dashboard`, `/ai-tahlil`, `/shartnomalar`, `/majburiyatlar`, `/vazifalar`, `/taqqoslash`, `/shablonlar`, `/analytics`, `/staff-lab`, `/kotib-tahlili`.
- Bilim bazasi sahifasi `/bilim-bazasi` URLda ishlaydi va client qo'llanmalari, CRM scriptlari, approval matrix, policy va risk playbooklarni RAG uchun yuklaydi.

## Backend

```
server/
  api/
    createHttpApp.mjs              # Express app, middleware va module wiring
    middleware/
      errorHandler.mjs             # Public error mapping
      pdfUpload.mjs                # PDF-only multer upload
  modules/
    health/
      healthRouter.mjs
    legal-analysis/
      analysisRouter.mjs           # HTTP endpoint
      analysisController.mjs       # Request/response orchestration
      legalPrompt.mjs              # Extraction prompt contract
      normalizeLegalAnalysis.mjs   # AI output -> stable API schema
      vertexLegalService.mjs       # Vertex/Gemini adapter
    knowledge/
      knowledgeRouter.mjs          # Knowledge base list/upload/delete endpoints
      knowledgeController.mjs      # Upload orchestration
      knowledgeService.mjs         # Vertex-powered document ingestion
      legalKnowledgeBase.mjs       # System/client corpus retrieval
      knowledgePrompt.mjs          # Client playbook normalization prompt
  platform/
    config/
      runtime.mjs                  # Env, credentials path, model fallback config
server.mjs                         # Process entrypoint
```

Backend qoidalari:
- `api/` HTTP infrastructure va cross-cutting middleware uchun.
- `modules/legal-analysis/` PDF analysis biznes moduli; prompt, controller, schema normalization va Vertex adapter shu yerda.
- `platform/config/` runtime environment va credential/model sozlamalari uchun.
- Route fayllari biznes logika yozmaydi; controller orchestration qiladi.
- Vertex modeli fallback ro'yxati configdan keladi, bitta model 404 bo'lsa keyingisi sinab ko'riladi.
- Frontendga faqat normalized JSON qaytadi; AI javobi to'g'ridan-to'g'ri UIga uzatilmaydi.
- Client knowledge hujjatlari `knowledge/uploads/` ichida saqlanadi va `.gitignore` qilingan; ular keyingi legal PDF tahlillarida RAG context sifatida ishlatiladi.

## Keyingi Kengaytirish

- Persistent DB: `server/modules/legal-analysis/repositories/` yoki yangi `server/modules/contracts/` moduli.
- Queue: `analysisController` ichidan sync extraction o'rniga job yaratish va status endpoint qo'shish.
- RAG: `server/modules/knowledge/` ichida embeddings, vector search va legal corpus retrieval.
- Webhook/API integratsiya: `server/modules/integrations/` ichida Hujjat.uz, DiDox, 1C adapterlari.
- Auth/RBAC: `server/modules/identity/` va frontendda workspace/user context.
- Observability: controller/service atrofida request id, latency, model name va extraction quality metrics.
