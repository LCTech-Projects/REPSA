import { getAccessToken } from "./authStorage";
import { getApiBaseUrl } from "./apiBaseUrl";

const API_BASE = getApiBaseUrl();

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};

async function authRequest<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as ApiResponse<T>;
  if (!res.ok) {
    throw new Error(json.error || json.message || "Request failed");
  }
  return json;
}

export type AuthUser = {
  id: string;
  email: string;
  email_verified: boolean;
};

export async function register(email: string, password: string) {
  return authRequest<{ user: AuthUser }>("/api/auth/register", {
    email,
    password,
  });
}

export async function signIn(email: string, password: string) {
  return authRequest<{ access_token: string; user: AuthUser }>("/api/auth/sign-in", {
    email,
    password,
  });
}

export async function verifyEmail(email: string, code: string) {
  return authRequest<{ user: AuthUser }>("/api/auth/verify-email", { email, code });
}

export async function resendVerification(email: string) {
  return authRequest<Record<string, never>>("/api/auth/resend-verification", { email });
}

export async function forgotPassword(email: string) {
  return authRequest<Record<string, never>>("/api/auth/forgot-password", { email });
}

export async function resetPassword(email: string, code: string, password: string) {
  return authRequest<Record<string, never>>("/api/auth/reset-password", {
    email,
    code,
    password,
  });
}

export async function fetchCurrentUser() {
  const token = getAccessToken();
  if (!token) {
    throw new Error("Not authenticated");
  }
  const res = await fetch(`${API_BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = (await res.json()) as ApiResponse<{ id: string; email: string }>;
  if (!res.ok) {
    throw new Error(json.error || json.message || "Request failed");
  }
  return json;
}
