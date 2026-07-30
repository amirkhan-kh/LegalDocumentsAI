import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHttpApp } from "./server/api/createHttpApp.mjs";
import { createRuntimeConfig } from "./server/platform/config/runtime.mjs";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const config = createRuntimeConfig();
const app = await createHttpApp({ config, rootDir });

const server = app.listen(config.port, "0.0.0.0", () => {
  console.log(`LegalAI server ready: http://localhost:${config.port}/`);
  console.log(`Vertex: project=${config.project || "unknown"} location=${config.location} models=${config.modelCandidates.join(",")}`);
  console.log(`PDF: maxBytes=${config.maxPdfBytes} softTargetMs=${config.analysisSoftTargetMs} hardTimeoutMs=${config.analysisHardTimeoutMs} chunkPages=${config.analysisChunkPages} bucket=${config.pdfGcsBucket || "inline-only"}`);
});

// Keep-alive heartbeat. On the production Node 22 runtime the listening socket
// alone does not hold the event loop open for this app — every background timer
// in the modules is unref()'d, so right after "server ready" the loop drains and
// the process exits with code 0 (systemd then restart-loops it). This ref'd timer
// is the single intentional handle that keeps the process running until a shutdown
// signal arrives; it is cleared in shutdown() so the process can exit cleanly.
const keepAlive = setInterval(() => {}, 60_000);

function shutdown(signal) {
  console.log(`[server] ${signal} received, shutting down gracefully...`);
  clearInterval(keepAlive);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
