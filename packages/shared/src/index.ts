/**
 * Shared DTOs exchanged between the Node/GramJS backend and the Next.js frontend.
 * These are plain, serializable shapes — no GramJS types leak across the boundary.
 * All Telegram ids are strings (they are 64-bit and must not be coerced to JS number).
 */

export type ChatType = "user" | "group" | "channel";

export interface ChatDTO {
  /** Marked peer id (GramJS getPeerId), stringified. Stable identifier used in URLs. */
  id: string;
  title: string;
  type: ChatType;
  unreadCount: number;
  lastMessage: { text: string; date: number } | null;
  /** Whether the chat has a profile photo (fetched lazily via the media endpoint). */
  hasPhoto: boolean;
}

export type MediaType =
  | "photo"
  | "video"
  | "audio"
  | "voice"
  | "document"
  | "sticker"
  | "other";

export interface MediaMeta {
  type: MediaType;
  fileName?: string;
  mimeType?: string;
  size?: number;
  width?: number;
  height?: number;
  /** Duration in seconds for audio/video. */
  duration?: number;
  /** True when a small thumbnail is available for inline preview. */
  hasThumb: boolean;
}

export interface MessageDTO {
  id: number;
  chatId: string;
  senderId: string | null;
  text: string;
  /** Unix timestamp (seconds). */
  date: number;
  /** True if the logged-in user sent this message. */
  out: boolean;
  replyToId: number | null;
  media: MediaMeta | null;
}

export interface MeDTO {
  id: string;
  firstName: string;
  lastName?: string;
  username?: string;
  phone?: string;
}

/* ------------------------------------------------------------------ */
/* Auth payloads                                                       */
/* ------------------------------------------------------------------ */

export interface SendCodeRequest {
  phone: string;
}
export interface SendCodeResponse {
  /** Opaque token identifying the in-progress login on the server. */
  tempToken: string;
}

export interface SignInRequest {
  tempToken: string;
  code: string;
}
export interface PasswordRequest {
  tempToken: string;
  password: string;
}

/** Result of sign-in / password steps. */
export interface AuthResult {
  /** Present when Telegram requires the 2FA cloud password next. */
  needPassword?: boolean;
  /** Present on successful authorization. */
  me?: MeDTO;
}

/* ------------------------------------------------------------------ */
/* REST responses                                                      */
/* ------------------------------------------------------------------ */

export interface DialogsResponse {
  chats: ChatDTO[];
}

export interface MessagesResponse {
  messages: MessageDTO[];
  /** offsetId to pass for the next (older) page; null when history is exhausted. */
  nextOffsetId: number | null;
}

export interface SendMessageRequest {
  text: string;
  replyToId?: number;
}

export interface SendMessageResponse {
  message: MessageDTO;
}

export interface SessionResponse {
  me: MeDTO;
}

/* ------------------------------------------------------------------ */
/* Realtime (socket.io) events: server -> client                       */
/* ------------------------------------------------------------------ */

export interface ServerToClientEvents {
  "message:new": (payload: { chatId: string; message: MessageDTO }) => void;
  "message:edit": (payload: { chatId: string; message: MessageDTO }) => void;
}

export interface ClientToServerEvents {
  // reserved for future client-initiated events (typing, read receipts, ...)
  ping: () => void;
}
