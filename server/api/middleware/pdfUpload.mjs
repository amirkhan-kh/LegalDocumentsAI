import multer from "multer";

export function createPdfUpload(maxPdfBytes) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxPdfBytes, files: 1 },
    fileFilter: (_req, file, cb) => {
      const isPdf = file.mimetype === "application/pdf" || /\.pdf$/i.test(file.originalname);
      cb(isPdf ? null : new Error("Faqat PDF fayl qabul qilinadi."), isPdf);
    },
  });
}
