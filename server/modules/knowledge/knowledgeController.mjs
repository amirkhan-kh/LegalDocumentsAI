import {
  deleteKnowledgeDocument,
  getLegalKnowledgeStats,
  listKnowledgeDocuments,
} from "./legalKnowledgeBase.mjs";

export function createKnowledgeController({ knowledgeService }) {
  return {
    list: (_req, res) => {
      res.json({
        documents: listKnowledgeDocuments(),
        stats: getLegalKnowledgeStats(),
      });
    },
    upload: (req, res, next) => uploadKnowledge(req, res, next, knowledgeService),
    delete: (req, res) => {
      const deleted = deleteKnowledgeDocument(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Bilim bazasi hujjati topilmadi yoki system hujjat o'chirilmaydi." });
      }
      return res.json({
        ok: true,
        documents: listKnowledgeDocuments(),
        stats: getLegalKnowledgeStats(),
      });
    },
  };
}

async function uploadKnowledge(req, res, next, knowledgeService) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Qo'llanma yoki bilim bazasi fayli yuborilmadi." });
    }
    console.log(`[api] knowledge upload start file="${req.file.originalname}" size=${req.file.size}`);
    const document = await knowledgeService.ingestDocument({
      file: req.file,
      title: req.body.title,
      domain: req.body.domain,
      language: req.body.language,
    });
    console.log(`[api] knowledge upload done id=${document.id} file="${req.file.originalname}"`);
    return res.json({
      document,
      documents: listKnowledgeDocuments(),
      stats: getLegalKnowledgeStats(),
    });
  } catch (error) {
    console.error(`[api] knowledge upload failed file="${req.file?.originalname || "unknown"}"`, error?.message || error);
    return next(error);
  }
}
