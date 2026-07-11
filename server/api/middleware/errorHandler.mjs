export function createErrorHandler({ isProduction }) {
  return function errorHandler(error, _req, res, _next) {
    const message = error?.message || "Server xatosi.";
    const status = message.includes("Faqat PDF") || message.includes("Bilim bazasi") || message.includes("File too large") ? 400 : 500;
    console.error("[api]", message);
    res.status(status).json({
      error: toPublicError(message),
      ...(isProduction ? {} : { debug: message }),
    });
  };
}

function toPublicError(message) {
  if (/not found|does not have access|NOT_FOUND|Hech qaysi Gemini modeli/i.test(message)) {
    return "Vertex AI modeli topilmadi yoki projectda access yo'q. Server avtomatik fallback modellarni ham sinadi; Google Cloud projectda Gemini model access/region sozlamasini tekshiring.";
  }
  if (/permission|denied|credential|auth|unauthorized/i.test(message)) {
    return "Google credential yoki Vertex AI ruxsatida muammo bor. Service account uchun Vertex AI User ruxsatini tekshiring.";
  }
  if (/quota|billing|resource exhausted/i.test(message)) {
    return "Vertex AI quota yoki billing limiti tugagan. Google Cloud billing/quota sozlamasini tekshiring.";
  }
  return message;
}
