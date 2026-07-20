import type { AuthSession, LoginChallenge } from "./types";

export async function fetchAuthSession(): Promise<AuthSession | null> {
  const response = await fetch("/api/auth/session", { credentials: "include" });
  if (response.status === 401) return null;
  return parseResponse<AuthSession>(response, "Sessiyani tekshirishda xatolik yuz berdi.");
}

export async function requestLogin(username: string, password: string): Promise<LoginChallenge> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return parseResponse<LoginChallenge>(response, "Kirish ma'lumotlarini tekshirib bo'lmadi.");
}

export async function verifyLogin(challengeToken: string): Promise<AuthSession> {
  const response = await fetch("/api/auth/verify", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ challengeToken }),
  });
  return parseResponse<AuthSession>(response, "Xavfsizlik tasdig'i bajarilmadi.");
}

export async function closeSession(csrfToken: string) {
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
    headers: { "X-CSRF-Token": csrfToken },
  });
  return parseResponse<{ ok: boolean }>(response, "Sessiyani yopib bo'lmadi.");
}

async function parseResponse<T>(response: Response, fallback: string): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof payload === "object" && payload && "error" in payload ? String(payload.error) : fallback);
  }
  return payload as T;
}
