const CSRF_STORAGE_KEY = "legalai.csrf";

export function setCsrfToken(value: string) {
  window.sessionStorage.setItem(CSRF_STORAGE_KEY, value);
}

export function getCsrfToken() {
  return window.sessionStorage.getItem(CSRF_STORAGE_KEY) || "";
}

export function clearCsrfToken() {
  window.sessionStorage.removeItem(CSRF_STORAGE_KEY);
}
