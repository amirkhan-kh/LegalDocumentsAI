import fs from "node:fs";
import { GoogleGenAI } from "@google/genai";
import { buildLegalPrompt } from "./legalPrompt.mjs";
import { retrieveLegalContext } from "../knowledge/legalKnowledgeBase.mjs";

export function createVertexLegalService(config) {
  let client = null;
  let activeModelName = null;

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

  async function extractPdf(file) {
    const knowledgeContext = retrieveLegalContext({
      query: `${file.originalname} contract extraction risk obligation alert payment termination renewal Uzbek Russian English`,
      limit: 4,
    });
    const prompt = buildLegalPrompt(file.originalname, knowledgeContext);
    const base64 = file.buffer.toString("base64");
    const errors = [];

    for (const candidateModel of config.modelCandidates) {
      try {
        const result = await getClient().models.generateContent({
          model: candidateModel,
          contents: [
            {
              role: "user",
              parts: [
                {
                  inlineData: {
                    mimeType: "application/pdf",
                    data: base64,
                  },
                },
                { text: prompt },
              ],
            },
          ],
          config: {
            temperature: 0.1,
            topP: 0.8,
            maxOutputTokens: config.maxOutputTokens,
            responseMimeType: "application/json",
          },
        });
        const parsed = parseJson(result.text || "");
        activeModelName = candidateModel;
        parsed.__model_used = candidateModel;
        return parsed;
      } catch (error) {
        errors.push(`${candidateModel}: ${error?.message || String(error)}`);
        if (!isRecoverableModelError(error)) {
          throw error;
        }
      }
    }

    throw new Error(`Hech qaysi Gemini modeli ishlamadi. Tekshirilgan modellar: ${config.modelCandidates.join(", ")}. Oxirgi xatolar: ${errors.join(" | ")}`);
  }

  return {
    extractPdf,
    getActiveModelName: () => activeModelName,
  };
}

function parseJson(text) {
  if (!text) throw new Error("Vertex AI bo'sh javob qaytardi.");
  try {
    return JSON.parse(text);
  } catch (_error) {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("Vertex AI JSON formatida javob qaytarmadi.");
    }
    return JSON.parse(match[0]);
  }
}

function isRecoverableModelError(error) {
  const message = String(error?.message || error);
  return /404|NOT_FOUND|not found|does not have access|not available|INVALID_ARGUMENT|JSON|Unexpected token|Unexpected end|Expected ','|Expected property/i.test(message);
}
