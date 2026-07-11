import fs from "node:fs";

const DEFAULT_CREDENTIAL_PATH = "/Users/amirxon/Desktop/big-quanta-469517-h6-55280c39d520.json";
const DEFAULT_MODELS = "gemini-2.5-pro,gemini-3.5-flash,gemini-2.5-flash,gemini-2.5-flash-lite";

export function createRuntimeConfig() {
  const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || DEFAULT_CREDENTIAL_PATH;
  const project = readProjectId(credentialPath);

  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialPath;
  }

  return {
    isProduction: process.env.NODE_ENV === "production",
    port: Number(process.env.PORT || 5174),
    credentialPath,
    project,
    location: process.env.VERTEX_LOCATION || process.env.GOOGLE_CLOUD_LOCATION || "global",
    modelCandidates: (process.env.VERTEX_MODEL || process.env.VERTEX_MODELS || DEFAULT_MODELS)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    maxPdfBytes: Number(process.env.MAX_PDF_BYTES || 50 * 1024 * 1024),
    maxKnowledgeBytes: Number(process.env.MAX_KNOWLEDGE_BYTES || 25 * 1024 * 1024),
    maxOutputTokens: Number(process.env.VERTEX_MAX_OUTPUT_TOKENS || 16_384),
  };
}

function readProjectId(credentialPath) {
  try {
    const raw = fs.readFileSync(credentialPath, "utf8");
    const parsed = JSON.parse(raw);
    return process.env.GOOGLE_CLOUD_PROJECT || parsed.project_id;
  } catch (_error) {
    return process.env.GOOGLE_CLOUD_PROJECT;
  }
}
