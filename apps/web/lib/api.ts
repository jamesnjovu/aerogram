import type {
  AuthResult,
  DialogsResponse,
  MessagesResponse,
  SendMessageResponse,
  SessionResponse,
  SendCodeResponse,
} from "@wt/shared";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, body.error ?? res.statusText, body);
  }
  // Some endpoints (logout) may return no JSON body.
  const text = await res.text();
  return (text ? JSON.parse(text) : {}) as T;
}

export const api = {
  sendCode: (phone: string) =>
    request<SendCodeResponse>("/auth/send-code", {
      method: "POST",
      body: JSON.stringify({ phone }),
    }),

  signIn: (tempToken: string, code: string) =>
    request<AuthResult>("/auth/sign-in", {
      method: "POST",
      body: JSON.stringify({ tempToken, code }),
    }),

  password: (tempToken: string, password: string) =>
    request<AuthResult>("/auth/password", {
      method: "POST",
      body: JSON.stringify({ tempToken, password }),
    }),

  me: () => request<SessionResponse>("/auth/me"),

  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),

  dialogs: () => request<DialogsResponse>("/dialogs"),

  messages: (chatId: string, offsetId = 0, limit = 30) =>
    request<MessagesResponse>(
      `/messages/${encodeURIComponent(chatId)}?limit=${limit}&offsetId=${offsetId}`,
    ),

  send: (chatId: string, text: string, replyToId?: number) =>
    request<SendMessageResponse>(`/messages/${encodeURIComponent(chatId)}`, {
      method: "POST",
      body: JSON.stringify({ text, replyToId }),
    }),
};

/** URL for a message's media (image/video/file). Cookies are sent (same-site). */
export function mediaUrl(
  chatId: string,
  messageId: number,
  opts?: { thumb?: boolean; download?: boolean },
): string {
  const params = new URLSearchParams();
  if (opts?.thumb) params.set("thumb", "1");
  if (opts?.download) params.set("download", "1");
  const qs = params.toString();
  return `${API_URL}/media/${encodeURIComponent(chatId)}/${messageId}${qs ? `?${qs}` : ""}`;
}

/** URL for a chat's avatar (profile photo). */
export function avatarUrl(chatId: string): string {
  return `${API_URL}/media/avatar/${encodeURIComponent(chatId)}`;
}
