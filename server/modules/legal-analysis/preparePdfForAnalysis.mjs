import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs/promises";
import { PDFDocument } from "pdf-lib";

const REPACK_THRESHOLD_BYTES = 5 * 1024 * 1024;

export async function preparePdfForAnalysis(file) {
  if (!file?.path || file.size < REPACK_THRESHOLD_BYTES) {
    return { file, repacked: false, uploadedBytes: file?.size || 0, analysisBytes: file?.size || 0 };
  }

  const preparedPath = path.join(path.dirname(file.path), `${path.basename(file.path, ".pdf")}-${crypto.randomUUID()}.analysis.pdf`);
  let sourceDocument;

  try {
    const sourceBytes = await fs.readFile(file.path);
    sourceDocument = await PDFDocument.load(sourceBytes, { updateMetadata: false });
  } catch (error) {
    throw preparationError("PDF ichki strukturasi o'qilmadi yoki fayl shifrlangan.", "INVALID_PDF", 400, error);
  }

  if (sourceDocument.getPageCount() < 1) {
    throw preparationError("PDF ichida tahlil qilinadigan sahifa topilmadi.", "INVALID_PDF", 400);
  }

  try {
    const analysisDocument = await PDFDocument.create();
    const pages = await analysisDocument.copyPages(sourceDocument, sourceDocument.getPageIndices());
    pages.forEach((page) => analysisDocument.addPage(page));
    analysisDocument.setTitle(file.originalname || "LegalAI analysis document");
    analysisDocument.setProducer("LegalAI page-only analysis pipeline");

    const analysisBytes = await analysisDocument.save({
      addDefaultPage: false,
      objectsPerTick: 50,
      useObjectStreams: true,
    });
    await fs.writeFile(preparedPath, analysisBytes, { flag: "wx", mode: 0o600 });

    return {
      file: {
        ...file,
        path: preparedPath,
        size: analysisBytes.byteLength,
      },
      repacked: true,
      uploadedBytes: file.size,
      analysisBytes: analysisBytes.byteLength,
    };
  } catch (error) {
    await fs.unlink(preparedPath).catch(() => undefined);
    throw preparationError("PDF sahifalarini AI tahlili uchun tayyorlab bo'lmadi.", "PDF_PREPARATION_FAILED", 500, error);
  }
}

function preparationError(message, code, status, cause) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  if (cause) error.cause = cause;
  return error;
}
