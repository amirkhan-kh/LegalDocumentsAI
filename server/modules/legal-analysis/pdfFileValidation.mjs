import fs from "node:fs/promises";

const HEADER_SCAN_BYTES = 1024;
const TRAILER_SCAN_BYTES = 8192;

export async function validatePdfFile(file, maxPdfBytes) {
  if (!file?.path || !Number.isFinite(file.size) || file.size <= 0) {
    throw pdfError("PDF fayl bo'sh yoki o'qib bo'lmaydi.", "INVALID_PDF", 400);
  }
  if (file.size > maxPdfBytes) {
    throw pdfError("PDF fayl 50MB dan oshmasligi kerak.", "PDF_TOO_LARGE", 413);
  }

  const handle = await fs.open(file.path, "r");
  try {
    const headLength = Math.min(HEADER_SCAN_BYTES, file.size);
    const head = Buffer.alloc(headLength);
    await handle.read(head, 0, headLength, 0);
    if (!head.toString("latin1").includes("%PDF-")) {
      throw pdfError("Fayl kengaytmasi PDF, lekin ichki PDF signaturasi topilmadi.", "INVALID_PDF", 400);
    }

    const tailLength = Math.min(TRAILER_SCAN_BYTES, file.size);
    const tail = Buffer.alloc(tailLength);
    await handle.read(tail, 0, tailLength, Math.max(0, file.size - tailLength));
    if (!tail.toString("latin1").includes("%%EOF")) {
      throw pdfError("PDF fayl buzilgan yoki to'liq yuklanmagan: EOF signaturasi topilmadi.", "INVALID_PDF", 400);
    }
  } finally {
    await handle.close();
  }
}

export async function removeUploadedPdf(file) {
  if (!file?.path) return;
  await fs.unlink(file.path).catch((error) => {
    if (error?.code !== "ENOENT") throw error;
  });
}

function pdfError(message, code, status) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}
