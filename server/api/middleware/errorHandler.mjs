export function createErrorHandler({ isProduction }) {
  return function errorHandler(error, _req, res, _next) {
    const message = error?.message || "Server xatosi.";
    const status = errorStatus(error, message);
    console.error("[api]", message);
    if (status === 429) res.setHeader("Retry-After", "30");
    res.status(status).json({
      error: toPublicError(error, message),
      code: String(error?.code || "SERVER_ERROR"),
      ...(isProduction ? {} : { debug: message }),
    });
  };
}

function errorStatus(error, message) {
  if (Number.isInteger(error?.status)) return error.status;
  if (error?.code === "LIMIT_FILE_SIZE" || error?.code === "PDF_TOO_LARGE") return 413;
  if (String(error?.code || "").startsWith("LIMIT_")) return 400;
  if (/Faqat PDF|PDF fayl|Bilim bazasi/i.test(message)) return 400;
  return 500;
}

export function toPublicError(error, message = error?.message || "Server xatosi.") {
  if (error?.code === "LIMIT_FILE_SIZE" || error?.code === "PDF_TOO_LARGE") {
    return "PDF fayl 50MB dan oshmasligi kerak.";
  }
  if (String(error?.code || "").startsWith("LIMIT_")) {
    return "PDF upload formati noto'g'ri yoki ruxsat etilgan fayl sonidan oshgan.";
  }
  if (error?.code === "INVALID_PDF" || error?.code === "INVALID_PDF_TYPE") return message;
  if (error?.code === "ANALYSIS_TIMEOUT") {
    return "Gemini Pro background tahlili yakuniy vaqt limitidan oshdi. Qayta urinib ko'ring.";
  }
  if (error?.code === "ANALYSIS_CHUNK_TIMEOUT") return message;
  if (error?.code === "ANALYSIS_BUSY") return message;
  if (error?.code === "VERTEX_GCS_CONFIG_ERROR") {
    return "Private GCS PDF staging ishlamayapti. Bucket va service-agent ruxsatlarini tekshiring.";
  }
  if (error?.code === "VERTEX_INVALID_JSON") {
    return "Gemini Pro javobi to'liq JSON bo'lmadi. PDF tahlilini qayta boshlang.";
  }
  if (error?.code === "VERTEX_UPSTREAM_ERROR") return message;
  if (/not found|does not have access|NOT_FOUND|Hech qaysi Gemini modeli/i.test(message)) {
    return "Vertex AI modeli topilmadi yoki projectda access yo'q. Google Cloud projectda Gemini Pro access va region sozlamasini tekshiring.";
  }
  if (/permission|denied|credential|auth|unauthorized/i.test(message)) {
    return "Google credential yoki Vertex AI ruxsatida muammo bor. Service account uchun Vertex AI User va GCS Object ruxsatlarini tekshiring.";
  }
  if (/quota|billing|resource exhausted/i.test(message)) {
    return "Vertex AI quota yoki billing limiti tugagan. Google Cloud billing/quota sozlamasini tekshiring.";
  }
  return isProductionSafeError(error) ? message : "Serverda kutilmagan xatolik yuz berdi.";
}

function isProductionSafeError(error) {
  return Number.isInteger(error?.status) && error.status < 500;
}
