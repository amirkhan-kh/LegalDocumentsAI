import multer from "multer";

const ALLOWED_EXTENSIONS = /\.(pdf|txt|md|markdown|csv|json)$/i;
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/csv",
  "application/json",
]);

export function createKnowledgeUpload(maxBytes) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes, files: 1 },
    fileFilter: (_req, file, cb) => {
      const isAllowed = ALLOWED_MIME_TYPES.has(file.mimetype) || ALLOWED_EXTENSIONS.test(file.originalname);
      cb(isAllowed ? null : new Error("Bilim bazasi uchun PDF, TXT, MD, CSV yoki JSON fayl qabul qilinadi."), isAllowed);
    },
  });
}
