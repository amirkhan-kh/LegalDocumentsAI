import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHttpApp } from "./server/api/createHttpApp.mjs";
import { createRuntimeConfig } from "./server/platform/config/runtime.mjs";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const config = createRuntimeConfig();
const app = await createHttpApp({ config, rootDir });

app.listen(config.port, "0.0.0.0", () => {
  console.log(`LegalAI server ready: http://localhost:${config.port}/`);
  console.log(`Vertex: project=${config.project || "unknown"} location=${config.location} models=${config.modelCandidates.join(",")}`);
  console.log(`PDF: maxBytes=${config.maxPdfBytes} softTargetMs=${config.analysisSoftTargetMs} hardTimeoutMs=${config.analysisHardTimeoutMs} chunkPages=${config.analysisChunkPages} bucket=${config.pdfGcsBucket || "inline-only"}`);
});
