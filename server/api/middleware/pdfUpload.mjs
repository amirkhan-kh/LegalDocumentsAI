import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import multer from "multer";

const uploadDirectory = path.join(os.tmpdir(), "legalai-pdf-uploads");
fs.mkdirSync(uploadDirectory, { recursive: true, mode: 0o700 });

export function createPdfUpload(maxPdfBytes) {
  return multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, uploadDirectory),
      filename: (_req, _file, cb) => cb(null, `${Date.now()}-${crypto.randomUUID()}.pdf`),
    }),
    limits: {
      fileSize: maxPdfBytes + 1,
      files: 1,
      fields: 0,
      parts: 2,
      fieldNameSize: 100,
    },
    fileFilter: (_req, file, cb) => {
      const validExtension = /\.pdf$/i.test(file.originalname);
      const validMime = ["application/pdf", "application/x-pdf", "application/octet-stream"].includes(file.mimetype);
      cb(validExtension && validMime ? null : uploadError("Faqat haqiqiy PDF fayl qabul qilinadi.", "INVALID_PDF_TYPE"), validExtension && validMime);
    },
  });
}

function uploadError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}
