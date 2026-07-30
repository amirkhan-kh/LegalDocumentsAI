import type { AuthSession, LoginChallenge, PublicPlan, SuperAdminOrg } from "./types";

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

export async function requestRegister(payload: {
  email: string;
  password: string;
  fullName?: string;
  organizationName: string;
  preferredPlan?: string;
}): Promise<LoginChallenge> {
  const response = await fetch("/api/auth/register", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseResponse<LoginChallenge>(response, "Ro'yxatdan o'tish bajarilmadi.");
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

export async function fetchPublicPlans(): Promise<{ plans: PublicPlan[]; trialDays: number }> {
  const response = await fetch("/api/auth/plans");
  return parseResponse(response, "Tariflar yuklanmadi.");
}

export async function superAdminListOrgs(csrfToken: string): Promise<SuperAdminOrg[]> {
  const response = await fetch("/api/super-admin/organizations", {
    credentials: "include",
    headers: { "X-CSRF-Token": csrfToken },
  });
  const data = await parseResponse<{ organizations: SuperAdminOrg[] }>(response, "Tashkilotlar yuklanmadi.");
  return data.organizations || [];
}

export async function superAdminActivateOrg(csrfToken: string, orgId: string, planCode: string, days = 30) {
  const response = await fetch(`/api/super-admin/organizations/${orgId}/activate`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
    body: JSON.stringify({ planCode, days }),
  });
  return parseResponse(response, "Faollashtirish bajarilmadi.");
}

export async function superAdminExtendTrial(csrfToken: string, orgId: string, days = 3) {
  const response = await fetch(`/api/super-admin/organizations/${orgId}/extend-trial`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
    body: JSON.stringify({ days }),
  });
  return parseResponse(response, "Trial uzaytirilmadi.");
}

export async function superAdminSuspendOrg(csrfToken: string, orgId: string) {
  const response = await fetch(`/api/super-admin/organizations/${orgId}/suspend`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
  });
  return parseResponse(response, "To'xtatish bajarilmadi.");
}

async function parseResponse<T>(response: Response, fallback: string): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof payload === "object" && payload && "error" in payload ? String(payload.error) : fallback);
  }
  return payload as T;
}
