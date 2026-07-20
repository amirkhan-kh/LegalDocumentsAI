import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import { cleanupPdfChunks, splitPdfIntoPageChunks } from "./splitPdfIntoPageChunks.mjs";

test("splitPdfIntoPageChunks creates ordered page ranges and valid PDFs", async (context) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "legalai-pdf-chunks-"));
  const sourcePath = path.join(directory, "contract.pdf");
  const source = await PDFDocument.create();
  for (let index = 0; index < 5; index += 1) source.addPage([612, 792]);
  const sourceBytes = await source.save();
  await fs.writeFile(sourcePath, sourceBytes);
  const file = { path: sourcePath, size: sourceBytes.byteLength, originalname: "contract.pdf", mimetype: "application/pdf" };
  let result;

  context.after(async () => {
    await cleanupPdfChunks(result?.chunks);
    await fs.rm(directory, { recursive: true, force: true });
  });

  result = await splitPdfIntoPageChunks(file, { pagesPerChunk: 2 });

  assert.equal(result.pageCount, 5);
  assert.equal(result.pagesPerChunk, 2);
  assert.deepEqual(result.chunks.map(({ pageStart, pageEnd, pageCount }) => ({ pageStart, pageEnd, pageCount })), [
    { pageStart: 1, pageEnd: 2, pageCount: 2 },
    { pageStart: 3, pageEnd: 4, pageCount: 2 },
    { pageStart: 5, pageEnd: 5, pageCount: 1 },
  ]);

  for (const chunk of result.chunks) {
    const bytes = await fs.readFile(chunk.file.path);
    const document = await PDFDocument.load(bytes);
    assert.equal(document.getPageCount(), chunk.pageCount);
    assert.equal(chunk.file.originalname, "contract.pdf");
    assert.equal(chunk.file.size, bytes.byteLength);
  }
});

test("splitPdfIntoPageChunks rejects invalid chunk size", async () => {
  await assert.rejects(
    splitPdfIntoPageChunks({ path: "/tmp/not-read.pdf" }, { pagesPerChunk: 0 }),
    (error) => error.code === "PDF_CHUNK_CONFIG_ERROR",
  );
});
