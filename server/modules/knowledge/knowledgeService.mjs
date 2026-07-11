import fs from "node:fs";
import { GoogleGenAI } from "@google/genai";
import { buildKnowledgeIngestionPrompt } from "./knowledgePrompt.mjs";
import { saveKnowledgeDocument } from "./legalKnowledgeBase.mjs";

export function createKnowledgeService(config) {
  let client = null;

  function getClient() {
    if (!config.project) {
      throw new Error("Google Cloud project_id topilmadi. Credential JSON yoki GOOGLE_CLOUD_PROJECT ni tekshiring.");
    }
    if (!fs.existsSync(config.credentialPath)) {
      throw new Error(`Google credential JSON topilmadi: ${config.credentialPath}`);
    }
    if (!client) {
      process.env.GOOGLE_CLOUD_PROJECT = config.project;
      process.env.GOOGLE_CLOUD_LOCATION = config.location;
      process.env.GOOGLE_GENAI_USE_ENTERPRISE = "true";
      client = new GoogleGenAI({
        vertexai: true,
        project: config.project,
        location: config.location,
      });
    }
    return client;
  }

  async function ingestDocument({ file, title, domain, language }) {
    const text = isTextLike(file) ? file.buffer.toString("utf8") : "";
    const prompt = buildKnowledgeIngestionPrompt({
      fileName: file.originalname,
      title,
      domain,
      language,
      text,
    });
    const raw = await generateKnowledgeJson({ file, prompt, includeFile: !text });
    const normalized = normalizeKnowledgePayload(raw, { fileName: file.originalname, title, domain, language, fallbackText: text });
    return saveKnowledgeDocument(normalized);
  }

  async function generateKnowledgeJson({ file, prompt, includeFile }) {
    const errors = [];
    for (const candidateModel of config.modelCandidates) {
      try {
        const parts = includeFile
          ? [
              {
                inlineData: {
                  mimeType: file.mimetype || "application/pdf",
                  data: file.buffer.toString("base64"),
                },
              },
              { text: prompt },
            ]
          : [{ text: prompt }];
        const result = await getClient().models.generateContent({
          model: candidateModel,
          contents: [{ role: "user", parts }],
          config: {
            temperature: 0.05,
            topP: 0.8,
            maxOutputTokens: config.maxOutputTokens,
            responseMimeType: "application/json",
          },
        });
        return parseJson(result.text || "");
      } catch (error) {
        errors.push(`${candidateModel}: ${error?.message || String(error)}`);
        if (!isRecoverableModelError(error)) throw error;
      }
    }
    throw new Error(`Bilim bazasi hujjatini AI orqali o'qib bo'lmadi. Xatolar: ${errors.join(" | ")}`);
  }

  return { ingestDocument };
}

function normalizeKnowledgePayload(raw, fallback) {
  return {
    title: String(raw.title || fallback.title || fallback.fileName.replace(/\.[^.]+$/, "")),
    domain: String(raw.domain || fallback.domain || "Other"),
    language: String(raw.language || fallback.language || "unknown"),
    sourceFileName: fallback.fileName,
    summary: String(raw.summary || ""),
    content: String(raw.content || fallback.fallbackText || ""),
    tags: Array.isArray(raw.tags) ? raw.tags.map(String).slice(0, 12) : [],
  };
}

function parseJson(text) {
  if (!text) throw new Error("Vertex AI bilim bazasi uchun bo'sh javob qaytardi.");
  try {
    return JSON.parse(text);
  } catch (_error) {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Vertex AI bilim bazasi javobini JSON formatida qaytarmadi.");
    return JSON.parse(match[0]);
  }
}

function isTextLike(file) {
  return /text\/|json|csv|markdown/i.test(file.mimetype) || /\.(txt|md|markdown|csv|json)$/i.test(file.originalname);
}

function isRecoverableModelError(error) {
  const message = String(error?.message || error);
  return /404|NOT_FOUND|not found|does not have access|not available|INVALID_ARGUMENT|JSON|Unexpected token|Unexpected end|Expected ','|Expected property/i.test(message);
}
