import type {
  AttachmentKind,
  AuthResult,
  Birthday,
  BotCallbackResponse,
  BotCommandsResponse,
  CallDTO,
  ChatInfoDTO,
  ContactDTO,
  CreateChatResponse,
  DialogsResponse,
  FolderDTO,
  MessagesResponse,
  ProfileDTO,
  SendMessageResponse,
  SessionResponse,
  SendCodeResponse,
  SharedMediaType,
  UpdateProfileRequest,
} from "@aerogram/shared";

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

  dialogs: (folderId = 0) =>
    request<DialogsResponse>(`/dialogs${folderId ? `?folderId=${folderId}` : ""}`),

  messages: (chatId: string, offsetId = 0, limit = 30) =>
    request<MessagesResponse>(
      `/messages/${encodeURIComponent(chatId)}?limit=${limit}&offsetId=${offsetId}`,
    ),

  send: (chatId: string, text: string, replyToId?: number) =>
    request<SendMessageResponse>(`/messages/${encodeURIComponent(chatId)}`, {
      method: "POST",
      body: JSON.stringify({ text, replyToId }),
    }),

  /* ------------------------------ profile ------------------------------ */
  getProfile: () => request<ProfileDTO>("/profile"),

  updateProfile: (data: UpdateProfileRequest) =>
    request<ProfileDTO>("/profile", { method: "POST", body: JSON.stringify(data) }),

  updateUsername: (username: string) =>
    request<ProfileDTO>("/profile/username", {
      method: "POST",
      body: JSON.stringify({ username }),
    }),

  updateBirthday: (b: Birthday) =>
    request<ProfileDTO>("/profile/birthday", { method: "POST", body: JSON.stringify(b) }),

  clearBirthday: () => request<ProfileDTO>("/profile/birthday", { method: "DELETE" }),

  uploadPhoto: (file: File) => uploadProfilePhoto(file),

  deletePhoto: () => request<ProfileDTO>("/profile/photo", { method: "DELETE" }),

  /* --------------------------- drawer features -------------------------- */
  createGroup: (title: string, about?: string) =>
    request<CreateChatResponse>("/chats/group", {
      method: "POST",
      body: JSON.stringify({ title, about }),
    }),

  createChannel: (title: string, about?: string) =>
    request<CreateChatResponse>("/chats/channel", {
      method: "POST",
      body: JSON.stringify({ title, about }),
    }),

  folders: () => request<{ folders: FolderDTO[] }>("/folders"),

  calls: () => request<{ calls: CallDTO[] }>("/calls"),

  contacts: () => request<{ contacts: ContactDTO[] }>("/contacts"),

  addMembers: (chatId: string, userIds: string[]) =>
    request<{ ok: true }>(`/chats/${encodeURIComponent(chatId)}/members`, {
      method: "POST",
      body: JSON.stringify({ userIds }),
    }),

  /* --------------------------- message actions -------------------------- */
  forward: (chatId: string, toChatId: string, messageIds: number[]) =>
    request<{ ok: true }>(`/messages/${encodeURIComponent(chatId)}/forward`, {
      method: "POST",
      body: JSON.stringify({ toChatId, messageIds }),
    }),

  deleteMessages: (chatId: string, messageIds: number[]) =>
    request<{ ok: true }>(`/messages/${encodeURIComponent(chatId)}/delete`, {
      method: "POST",
      body: JSON.stringify({ messageIds }),
    }),

  editMessage: (chatId: string, messageId: number, text: string) =>
    request<SendMessageResponse>(
      `/messages/${encodeURIComponent(chatId)}/${messageId}/edit`,
      { method: "POST", body: JSON.stringify({ text }) },
    ),

  /* ----------------------------- chat details --------------------------- */
  chatInfo: (chatId: string) =>
    request<ChatInfoDTO>(`/chats/${encodeURIComponent(chatId)}/info`),

  muteChat: (chatId: string, muted: boolean) =>
    request<{ ok: true }>(`/chats/${encodeURIComponent(chatId)}/mute`, {
      method: "POST",
      body: JSON.stringify({ muted }),
    }),

  leaveChat: (chatId: string) =>
    request<{ ok: true }>(`/chats/${encodeURIComponent(chatId)}/leave`, { method: "POST" }),

  sharedMedia: (chatId: string, type: SharedMediaType, offsetId = 0) =>
    request<MessagesResponse>(
      `/chats/${encodeURIComponent(chatId)}/media?type=${type}&offsetId=${offsetId}`,
    ),

  /* ----------------------------- attachments ---------------------------- */
  sendAttachment: (chatId: string, kind: AttachmentKind, file: File, caption?: string) =>
    uploadAttachment(chatId, kind, file, caption),

  sendLocation: (chatId: string, lat: number, long: number) =>
    request<{ ok: true }>(`/messages/${encodeURIComponent(chatId)}/location`, {
      method: "POST",
      body: JSON.stringify({ lat, long }),
    }),

  sendPoll: (
    chatId: string,
    question: string,
    options: string[],
    opts?: { anonymous?: boolean; quiz?: boolean; correctOption?: number },
  ) =>
    request<{ ok: true }>(`/messages/${encodeURIComponent(chatId)}/poll`, {
      method: "POST",
      body: JSON.stringify({ question, options, ...opts }),
    }),

  botCommands: (chatId: string) =>
    request<BotCommandsResponse>(`/chats/${encodeURIComponent(chatId)}/bot`),

  botCallback: (chatId: string, messageId: number, data: string) =>
    request<BotCallbackResponse>(
      `/messages/${encodeURIComponent(chatId)}/${messageId}/callback`,
      { method: "POST", body: JSON.stringify({ data }) },
    ),
};

/** Multipart attachment upload (kind + caption as query params). */
async function uploadAttachment(
  chatId: string,
  kind: AttachmentKind,
  file: File,
  caption?: string,
): Promise<{ ok: true }> {
  const fd = new FormData();
  fd.append("file", file);
  const qs = new URLSearchParams({ kind });
  if (caption) qs.set("caption", caption);
  const res = await fetch(
    `${API_URL}/messages/${encodeURIComponent(chatId)}/attach?${qs.toString()}`,
    { method: "POST", credentials: "include", body: fd },
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, body.error ?? res.statusText, body);
  }
  return res.json() as Promise<{ ok: true }>;
}

/** Multipart upload for the profile photo (can't go through the JSON `request` helper). */
async function uploadProfilePhoto(file: File): Promise<ProfileDTO> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${API_URL}/profile/photo`, {
    method: "POST",
    credentials: "include",
    body: fd,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, body.error ?? res.statusText, body);
  }
  return res.json() as Promise<ProfileDTO>;
}

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

/** URL for the logged-in user's own avatar. Pass a version to bust the cache after changes. */
export function selfAvatarUrl(version?: number): string {
  return `${API_URL}/profile/avatar${version ? `?v=${version}` : ""}`;
}
