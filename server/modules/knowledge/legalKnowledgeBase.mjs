import fs from "node:fs";
import path from "node:path";

const CORPUS_DIR = path.join(process.cwd(), "knowledge", "corpus");
const UPLOADS_DIR = path.join(process.cwd(), "knowledge", "uploads");
const MANIFEST_PATH = path.join(UPLOADS_DIR, "manifest.json");
let cachedChunks = null;

export function retrieveLegalContext({ query = "", limit = 4 } = {}) {
  const chunks = loadChunks();
  if (!chunks.length) return "";
  const queryTokens = tokenize(query);
  const ranked = chunks
    .map((chunk) => ({
      ...chunk,
      score: scoreChunk(chunk, queryTokens),
    }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, limit);

  return ranked
    .map((chunk, index) => `Context ${index + 1} [${chunk.id}]:\n${chunk.text}`)
    .join("\n\n");
}

export function getLegalKnowledgeStats() {
  const chunks = loadChunks();
  const documents = listKnowledgeDocuments();
  return {
    corpusDir: CORPUS_DIR,
    uploadsDir: UPLOADS_DIR,
    chunks: chunks.length,
    files: Array.from(new Set(chunks.map((chunk) => chunk.fileName))).sort(),
    documents: documents.length,
  };
}

export function listKnowledgeDocuments() {
  const uploaded = readManifest();
  const system = readKnowledgeFiles(CORPUS_DIR, "system").map((file) => ({
    id: file.metadata.id || file.fileName,
    title: titleFromMarkdown(file.body) || file.fileName,
    kind: "system",
    domain: file.metadata.domain || "general",
    language: file.metadata.language || "unknown",
    sourceFileName: file.fileName,
    uploadedAt: null,
    chunks: splitBody(file.body).length,
  }));
  return [...system, ...uploaded.documents].sort((a, b) => String(b.uploadedAt || "").localeCompare(String(a.uploadedAt || "")));
}

export function saveKnowledgeDocument({ title, domain, language, sourceFileName, summary, content, tags = [] }) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  const id = `kb-${Date.now()}-${slugify(title || sourceFileName).slice(0, 28) || "document"}`;
  const fileName = `${id}.md`;
  const markdown = [
    "---",
    `id: ${id}`,
    `language: ${safeMeta(language || "unknown")}`,
    `domain: ${safeMeta(domain || "business-playbook")}`,
    "authority: client-upload",
    `source_file: ${safeMeta(sourceFileName || "")}`,
    "---",
    "",
    `# ${title || sourceFileName || "Client knowledge document"}`,
    "",
    summary ? `## Summary\n\n${summary}` : "",
    "",
    "## Grounding Content",
    "",
    content || "No content extracted.",
  ].filter(Boolean).join("\n");
  fs.writeFileSync(path.join(UPLOADS_DIR, fileName), markdown);

  const manifest = readManifest();
  const document = {
    id,
    title: title || sourceFileName || "Client knowledge document",
    kind: "client",
    domain: domain || "business-playbook",
    language: language || "unknown",
    sourceFileName: sourceFileName || "",
    uploadedAt: new Date().toISOString(),
    fileName,
    tags,
    chunks: splitBody(markdown).length,
  };
  manifest.documents = [document, ...manifest.documents.filter((item) => item.id !== id)];
  writeManifest(manifest);
  invalidateLegalKnowledgeCache();
  return document;
}

export function deleteKnowledgeDocument(id) {
  const manifest = readManifest();
  const document = manifest.documents.find((item) => item.id === id);
  if (!document) return false;
  const filePath = path.join(UPLOADS_DIR, document.fileName || `${id}.md`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  manifest.documents = manifest.documents.filter((item) => item.id !== id);
  writeManifest(manifest);
  invalidateLegalKnowledgeCache();
  return true;
}

export function invalidateLegalKnowledgeCache() {
  cachedChunks = null;
}

function loadChunks() {
  if (cachedChunks) return cachedChunks;
  cachedChunks = [
    ...readKnowledgeFiles(CORPUS_DIR, "system"),
    ...readKnowledgeFiles(UPLOADS_DIR, "client"),
  ]
    .flatMap((fileName) => {
      return splitBody(fileName.body).map((text, index) => ({
        id: `${fileName.metadata.id || fileName.fileName}#${index + 1}`,
        fileName: fileName.fileName,
        metadata: { ...fileName.metadata, kind: fileName.kind },
        text,
        tokens: tokenize(`${fileName.metadata.domain || ""} ${fileName.metadata.language || ""} ${text}`),
      }));
    });
  return cachedChunks;
}

function readKnowledgeFiles(directory, kind) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory)
    .filter((fileName) => fileName.endsWith(".md"))
    .map((fileName) => {
      const raw = fs.readFileSync(path.join(directory, fileName), "utf8");
      const { metadata, body } = splitFrontmatter(raw);
      return { fileName, metadata, body, kind };
    });
}

function splitFrontmatter(raw) {
  if (!raw.startsWith("---")) return { metadata: {}, body: raw };
  const end = raw.indexOf("\n---", 3);
  if (end === -1) return { metadata: {}, body: raw };
  const frontmatter = raw.slice(3, end).trim();
  const metadata = {};
  for (const line of frontmatter.split("\n")) {
    const [key, ...rest] = line.split(":");
    if (key && rest.length) metadata[key.trim()] = rest.join(":").trim();
  }
  return { metadata, body: raw.slice(end + 4).trim() };
}

function splitBody(body) {
  const sections = body
    .split(/\n(?=##? )/g)
    .map((section) => section.trim())
    .filter(Boolean);
  return sections.length ? sections : [body.trim()].filter(Boolean);
}

function scoreChunk(chunk, queryTokens) {
  if (!queryTokens.size) return 1;
  let score = 0;
  for (const token of queryTokens) {
    if (chunk.tokens.has(token)) score += 1;
  }
  return score / queryTokens.size;
}

function tokenize(value) {
  const stop = new Set(["the", "and", "for", "with", "dan", "ham", "yoki", "uchun", "bilan", "pdf"]);
  return new Set(String(value)
    .toLowerCase()
    .replace(/[^a-z0-9а-яёғқўҳіїъ'-]+/gi, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !stop.has(token)));
}

function readManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) return { documents: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
    return { documents: Array.isArray(parsed.documents) ? parsed.documents : [] };
  } catch (_error) {
    return { documents: [] };
  }
}

function writeManifest(manifest) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify({ documents: manifest.documents || [] }, null, 2));
}

function titleFromMarkdown(body) {
  const match = body.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() || "";
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9а-яёғқўҳіїъ-]+/gi, "-")
    .replace(/^-+|-+$/g, "");
}

function safeMeta(value) {
  return String(value).replace(/\n/g, " ").replace(/:/g, " -").trim();
}
