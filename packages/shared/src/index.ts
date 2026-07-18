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
  /** Whether the logged-in user is allowed to send messages here (false for read-only channels). */
  canPost: boolean;
  /** Whether this chat is a bot. */
  isBot: boolean;
  /** Public @username, if any (used for deep links). */
  username?: string;
}

export type MediaType =
  | "photo"
  | "video"
  | "audio"
  | "voice"
  | "document"
  | "sticker"
  | "location"
  | "poll"
  | "contact"
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
  /** Location messages. */
  lat?: number;
  long?: number;
  /** Poll messages. */
  question?: string;
  options?: string[];
  /** Contact messages. */
  phone?: string;
}

export type ButtonKind = "callback" | "url" | "text" | "other";

export interface MessageButton {
  text: string;
  kind: ButtonKind;
  url?: string;
  /** base64-encoded callback data (for callback buttons). */
  data?: string;
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
  /** True for Telegram service messages (joins, title changes, pins, …); `text` holds a summary. */
  service: boolean;
  /** Present for phone/video call service messages. */
  call?: {
    video: boolean;
    missed: boolean;
    duration?: number;
  };
  /** Inline/reply keyboard buttons attached to the message (bots). */
  buttons?: MessageButton[][];
}

export interface BotCallbackResponse {
  text?: string;
  alert: boolean;
  url?: string;
}

export interface MeDTO {
  id: string;
  firstName: string;
  lastName?: string;
  username?: string;
  phone?: string;
}

export interface Birthday {
  day: number;
  month: number;
  year?: number;
}

/** Full self-profile (from users.getFullUser) used by the settings page. */
export interface ProfileDTO {
  id: string;
  firstName: string;
  lastName?: string;
  username?: string;
  phone?: string;
  bio?: string;
  birthday?: Birthday;
  hasPhoto: boolean;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  bio?: string;
}

export interface UpdateUsernameRequest {
  username: string;
}

export type UpdateBirthdayRequest = Birthday;

/* ------------------------------------------------------------------ */
/* Drawer features: folders, calls, new group/channel                  */
/* ------------------------------------------------------------------ */

export interface FolderDTO {
  /** 0 is the built-in "All chats" folder. */
  id: number;
  title: string;
  emoticon?: string;
}

export interface CallDTO {
  id: number;
  /** Unix timestamp (seconds). */
  date: number;
  /** True if the logged-in user placed the call. */
  out: boolean;
  video: boolean;
  duration?: number;
  missed: boolean;
}

export interface CreateChatRequest {
  title: string;
  about?: string;
}

export interface CreateChatResponse {
  /** Marked id of the created group/channel, usable in /chat/:id. */
  id: string;
}

export interface ContactDTO {
  id: string;
  name: string;
  username?: string;
  phone?: string;
  hasPhoto: boolean;
}

export interface ForwardRequest {
  toChatId: string;
  messageIds: number[];
}

export interface EditMessageRequest {
  text: string;
}

export interface AddMembersRequest {
  userIds: string[];
}

/* ------------------------------------------------------------------ */
/* Chat details + shared media                                         */
/* ------------------------------------------------------------------ */

export interface ChatInfoDTO {
  id: string;
  title: string;
  type: ChatType;
  username?: string;
  about?: string;
  memberCount?: number;
  muted: boolean;
  /** True for groups/channels the user can leave. */
  canLeave: boolean;
  /** Public/invite link, if any. */
  link?: string;
}

export type SharedMediaType = "media" | "file" | "link" | "music" | "voice" | "gif";

/* ------------------------------------------------------------------ */
/* Attachments + bots                                                  */
/* ------------------------------------------------------------------ */

export type AttachmentKind = "photo" | "video" | "file" | "music" | "voice";

export interface SendLocationRequest {
  lat: number;
  long: number;
}

export interface SendPollRequest {
  question: string;
  options: string[];
  /** Anonymous voting (default true). When false, voters are public. */
  anonymous?: boolean;
  /** Quiz mode — exactly one correct answer. */
  quiz?: boolean;
  /** Index (within options) of the correct answer, for quiz mode. */
  correctOption?: number;
}

export interface BotCommand {
  command: string;
  description: string;
}

export interface BotCommandsResponse {
  commands: BotCommand[];
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
