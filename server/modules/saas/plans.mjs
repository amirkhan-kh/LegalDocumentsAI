/**
 * LegalAI SaaS pricing — INTERNAL cost model.
 *
 * Vertex cost estimate (Gemini 2.5 Pro, avg contract PDF analysis):
 *   - Small (≤20 pages, direct):  ~$0.12–0.30 real
 *   - Medium (chunked 20–40 p):   ~$0.35–0.80 real
 *   - Large (40–80 p multi-chunk):~$0.80–1.80 real
 *   Blended average usage:        ~$0.40–0.55 / analysis
 *
 * Sell unit includes buffer + margin over real Vertex.
 * PLATFORM_BASE_USD covers infra, support, GCS, sessions — NEVER expose in UI.
 * Customers only see final package price + analysis quota.
 */

export const TRIAL_DAYS = 3;
export const TRIAL_ANALYSIS_LIMIT = 5;

/** @internal Do not send these fields to the client. */
export const INTERNAL_COST = Object.freeze({
  platformBaseUsd: 70,
  /** Blended sell attribution per AI analysis (not shown in UI). */
  vertexUnitUsd: 2,
  /** Rough real Vertex estimate for margin audits only. */
  estimatedRealVertexPerAnalysisUsd: 0.45,
});

/**
 * @typedef {object} PlanSpec
 * @property {string} code
 * @property {string} name
 * @property {number} analysesMonthly
 * @property {number} seats
 * @property {string} blurb
 * @property {string[]} features
 * @property {boolean} popular
 * @property {number} sortOrder
 */

/** @type {PlanSpec[]} */
const PLAN_SPECS = [
  {
    code: "start",
    name: "Start",
    analysesMonthly: 20,
    seats: 1,
    blurb: "Yakka yurist va kichik amaliyotlar uchun.",
    features: [
      "PDF shartnoma AI tahlili",
      "Risk va majburiyatlar chiqarish",
      "1 foydalanuvchi",
      "Email qo'llab-quvvatlash",
    ],
    popular: false,
    sortOrder: 10,
  },
  {
    code: "growth",
    name: "Growth",
    analysesMonthly: 50,
    seats: 3,
    blurb: "Yuridik jamoalar va o'sayotgan firmalar.",
    features: [
      "Barcha Start imkoniyatlari",
      "Majburiyat va vazifa navbati",
      "3 foydalanuvchi",
      "Taqqoslash va shablonlar",
      "Ustuvor qo'llab-quvvatlash",
    ],
    popular: true,
    sortOrder: 20,
  },
  {
    code: "business",
    name: "Business",
    analysesMonthly: 120,
    seats: 10,
    blurb: "Korporativ yuridik bo'limlar uchun.",
    features: [
      "Barcha Growth imkoniyatlari",
      "Bilim bazasi (RAG)",
      "10 foydalanuvchi",
      "Analitika va hisobotlar",
      "Tezroq AI navbat",
    ],
    popular: false,
    sortOrder: 30,
  },
  {
    code: "scale",
    name: "Scale",
    analysesMonthly: 300,
    seats: 25,
    blurb: "Yirik tarmoq va yuridik firmalar.",
    features: [
      "Barcha Business imkoniyatlari",
      "25 foydalanuvchi",
      "Maxsus onboarding",
      "Prioritet support",
      "Custom limit so'rovi",
    ],
    popular: false,
    sortOrder: 40,
  },
];

function computePriceUsd(analysesMonthly) {
  return Math.round(INTERNAL_COST.platformBaseUsd + analysesMonthly * INTERNAL_COST.vertexUnitUsd);
}

/** Public plan list for landing / API — no cost breakdown. */
export function listPublicPlans() {
  return PLAN_SPECS.map((spec) => ({
    id: spec.code,
    code: spec.code,
    name: spec.name,
    priceUsd: computePriceUsd(spec.analysesMonthly),
    analysesMonthly: spec.analysesMonthly,
    seats: spec.seats,
    blurb: spec.blurb,
    features: spec.features,
    popular: spec.popular,
    sortOrder: spec.sortOrder,
  }));
}

export function getPlanByCode(code) {
  const plans = listPublicPlans();
  return plans.find((p) => p.code === String(code || "").toLowerCase()) || null;
}

/** Super-admin only: margin snapshot (never for marketing UI). */
export function getInternalCostAudit() {
  const plans = listPublicPlans();
  return {
    note: "Internal only — never surface platformBase or unit breakdown in customer UI",
    platformBaseUsd: INTERNAL_COST.platformBaseUsd,
    vertexUnitUsd: INTERNAL_COST.vertexUnitUsd,
    estimatedRealVertexPerAnalysisUsd: INTERNAL_COST.estimatedRealVertexPerAnalysisUsd,
    plans: plans.map((p) => {
      const attributedVertex = p.analysesMonthly * INTERNAL_COST.vertexUnitUsd;
      const estimatedReal = p.analysesMonthly * INTERNAL_COST.estimatedRealVertexPerAnalysisUsd;
      return {
        code: p.code,
        priceUsd: p.priceUsd,
        analysesMonthly: p.analysesMonthly,
        attributedVertexUsd: attributedVertex,
        platformBaseUsd: INTERNAL_COST.platformBaseUsd,
        estimatedRealVertexUsd: Math.round(estimatedReal * 100) / 100,
        estimatedGrossMarginUsd: Math.round((p.priceUsd - estimatedReal) * 100) / 100,
      };
    }),
  };
}
