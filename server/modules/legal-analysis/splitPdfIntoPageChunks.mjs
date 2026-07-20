import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";

const DEFAULT_PAGES_PER_CHUNK = 12;
const MAX_PAGES_PER_CHUNK = 100;

export async function splitPdfIntoPageChunks(file, options = {}) {
  const pagesPerChunk = normalizePagesPerChunk(options.pagesPerChunk);
  const signal = options.signal;

  if (!file?.path) {
    throw chunkingError("PDF chunklash uchun vaqtinchalik fayl yo'li topilmadi.", "PDF_CHUNK_INPUT_ERROR", 400);
  }

  const outputDir = options.outputDir || path.dirname(file.path);
  const createdPaths = [];

  try {
    throwIfAborted(signal);
    const sourceBytes = await fs.readFile(file.path, { signal });
    let sourceDocument;

    try {
      sourceDocument = await PDFDocument.load(sourceBytes, { updateMetadata: false });
    } catch (error) {
      throw chunkingError("PDF ichki strukturasi o'qilmadi yoki fayl shifrlangan.", "INVALID_PDF", 400, error);
    }

    const pageCount = sourceDocument.getPageCount();
    if (pageCount < 1) {
      throw chunkingError("PDF ichida tahlil qilinadigan sahifa topilmadi.", "INVALID_PDF", 400);
    }

    const chunks = [];
    for (let pageStart = 1, index = 0; pageStart <= pageCount; pageStart += pagesPerChunk, index += 1) {
      throwIfAborted(signal);
      const pageEnd = Math.min(pageCount, pageStart + pagesPerChunk - 1);
      const pageIndices = Array.from({ length: pageEnd - pageStart + 1 }, (_, pageIndex) => pageStart + pageIndex - 1);
      const chunkDocument = await PDFDocument.create();
      const copiedPages = await chunkDocument.copyPages(sourceDocument, pageIndices);
      copiedPages.forEach((page) => chunkDocument.addPage(page));
      chunkDocument.setTitle(file.originalname || path.basename(file.path));
      chunkDocument.setProducer("LegalAI adaptive page chunk pipeline");

      const chunkBytes = await chunkDocument.save({
        addDefaultPage: false,
        objectsPerTick: 50,
        useObjectStreams: true,
      });
      const chunkPath = buildChunkPath(file.path, outputDir, pageStart, pageEnd);
      await fs.writeFile(chunkPath, chunkBytes, { flag: "wx", mode: 0o600, signal });
      createdPaths.push(chunkPath);
      chunks.push({
        index,
        pageStart,
        pageEnd,
        pageCount: pageEnd - pageStart + 1,
        file: {
          ...file,
          path: chunkPath,
          size: chunkBytes.byteLength,
        },
      });
    }

    return { pageCount, pagesPerChunk, chunks };
  } catch (error) {
    await Promise.all(createdPaths.map((createdPath) => fs.unlink(createdPath).catch(() => undefined)));
    if (signal?.aborted && error?.code !== "CLIENT_ABORTED") {
      throw chunkingError("PDF chunklash client tomonidan bekor qilindi.", "CLIENT_ABORTED", 499, error);
    }
    if (error?.code) throw error;
    throw chunkingError("PDF sahifalarini parallel tahlil uchun ajratib bo'lmadi.", "PDF_CHUNKING_FAILED", 500, error);
  }
}

export async function cleanupPdfChunks(chunks) {
  const paths = Array.isArray(chunks)
    ? chunks.map((chunk) => chunk?.file?.path).filter(Boolean)
    : [];
  await Promise.all(paths.map((chunkPath) => fs.unlink(chunkPath).catch(() => undefined)));
}

function normalizePagesPerChunk(value) {
  if (value === undefined) return DEFAULT_PAGES_PER_CHUNK;
  const pagesPerChunk = Number(value);
  if (!Number.isInteger(pagesPerChunk) || pagesPerChunk < 1 || pagesPerChunk > MAX_PAGES_PER_CHUNK) {
    throw chunkingError(`pagesPerChunk 1-${MAX_PAGES_PER_CHUNK} oralig'idagi butun son bo'lishi kerak.`, "PDF_CHUNK_CONFIG_ERROR", 500);
  }
  return pagesPerChunk;
}

function buildChunkPath(sourcePath, outputDir, pageStart, pageEnd) {
  const extension = path.extname(sourcePath);
  const baseName = path.basename(sourcePath, extension);
  return path.join(outputDir, `${baseName}.pages-${pageStart}-${pageEnd}.${crypto.randomUUID()}.pdf`);
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw chunkingError("PDF chunklash client tomonidan bekor qilindi.", "CLIENT_ABORTED", 499);
  }
}

function chunkingError(message, code, status, cause) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  if (cause) error.cause = cause;
  return error;
}
