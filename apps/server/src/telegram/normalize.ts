import { Api } from "telegram";
import type {
  ChatDTO,
  ChatType,
  MediaMeta,
  MediaType,
  MessageButton,
  MessageDTO,
  MessageEntity,
  MessageEntityType,
  MeDTO,
} from "@aerogram/shared";

/**
 * Convert GramJS objects into the plain DTOs the frontend consumes.
 * GramJS uses `big-integer` for 64-bit ids; everything crossing the wire is stringified.
 * These functions are pure and unit-tested (see normalize.test.ts).
 */

/** Best-effort stringify of a GramJS/bigInt/number id. */
export function idStr(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  return String(v);
}

export function entityType(entity: unknown): ChatType {
  const cls = (entity as { className?: string })?.className;
  if (cls === "Channel") {
    // megagroups (supergroups) are Channels with megagroup=true → treat as group
    return (entity as { megagroup?: boolean }).megagroup ? "group" : "channel";
  }
  if (cls === "Chat" || cls === "ChatForbidden") return "group";
  return "user";
}

export function entityTitle(entity: unknown): string {
  const e = entity as {
    title?: string;
    firstName?: string;
    lastName?: string;
    username?: string;
  };
  if (e?.title) return e.title;
  const name = [e?.firstName, e?.lastName].filter(Boolean).join(" ").trim();
  if (name) return name;
  if (e?.username) return e.username;
  return "Unknown";
}

/** Whether the logged-in user may send messages in this chat. */
function computeCanPost(entity: unknown): boolean {
  const e = entity as {
    className?: string;
    megagroup?: boolean;
    creator?: boolean;
    adminRights?: { postMessages?: boolean } | null;
    defaultBannedRights?: { sendMessages?: boolean } | null;
    left?: boolean;
  };
  const cls = e?.className;
  if (cls === "Channel" || cls === "ChannelForbidden") {
    if (e.megagroup) {
      // Supergroup: can post unless everyone is banned from sending.
      if (e.creator || e.adminRights) return true;
      return !e.defaultBannedRights?.sendMessages;
    }
    // Broadcast channel: only the creator or admins with post rights can write.
    return Boolean(e.creator || e.adminRights?.postMessages);
  }
  if (cls === "Chat" || cls === "ChatForbidden") {
    if (e.creator || e.adminRights) return true;
    return !e.defaultBannedRights?.sendMessages;
  }
  // Users, saved messages, etc.
  return true;
}

/** A GramJS Dialog (from client.getDialogs()). Typed loosely — GramJS Dialog is a helper class. */
export function normalizeDialog(dialog: any): ChatDTO {
  const entity = dialog.entity;
  const last = dialog.message;
  return {
    id: String(dialog.id),
    title: entityTitle(entity),
    type: entityType(entity),
    unreadCount: dialog.unreadCount ?? 0,
    lastMessage: last
      ? {
          text: last.message ?? mediaSummary(last.media) ?? "",
          date: last.date ?? 0,
        }
      : null,
    hasPhoto: Boolean(entity?.photo && entity.photo.className !== "ChatPhotoEmpty"),
    canPost: computeCanPost(entity),
    isBot: Boolean((entity as { className?: string; bot?: boolean })?.className === "User" &&
      (entity as { bot?: boolean }).bot),
    username: (entity as { username?: string })?.username || undefined,
  };
}

function mediaSummary(media: unknown): string | null {
  if (!media) return null;
  const cls = (media as { className?: string }).className;
  switch (cls) {
    case "MessageMediaPhoto":
      return "📷 Photo";
    case "MessageMediaDocument":
      return "📎 File";
    case "MessageMediaGeo":
    case "MessageMediaGeoLive":
      return "📍 Location";
    case "MessageMediaContact":
      return "👤 Contact";
    default:
      return null;
  }
}

export function normalizeMediaMeta(media: unknown): MediaMeta | null {
  if (!media) return null;
  const m = media as any;
  const cls: string | undefined = m.className;

  if (cls === "MessageMediaPhoto" && m.photo) {
    const largest = pickLargestPhotoSize(m.photo.sizes ?? []);
    return {
      type: "photo",
      width: largest?.w,
      height: largest?.h,
      hasThumb: true,
    };
  }

  if (cls === "MessageMediaDocument" && m.document) {
    const doc = m.document;
    const attrs: any[] = doc.attributes ?? [];
    const video = attrs.find((a) => a.className === "DocumentAttributeVideo");
    const audio = attrs.find((a) => a.className === "DocumentAttributeAudio");
    const sticker = attrs.find((a) => a.className === "DocumentAttributeSticker");
    const image = attrs.find((a) => a.className === "DocumentAttributeImageSize");
    const animated = attrs.find((a) => a.className === "DocumentAttributeAnimated");
    const fileNameAttr = attrs.find((a) => a.className === "DocumentAttributeFilename");

    let type: MediaType = "document";
    if (sticker) type = "sticker";
    else if (video) type = "video";
    else if (audio) type = audio.voice ? "voice" : "audio";

    const dims = video ?? image;
    // GIFs are silent MP4s; other videos say so with the nosound flag.
    const silent = type === "video" ? Boolean(video?.nosound || animated) : false;
    return {
      type,
      fileName: fileNameAttr?.fileName,
      mimeType: doc.mimeType,
      size: doc.size !== undefined ? Number(doc.size) : undefined,
      width: dims?.w,
      height: dims?.h,
      duration: video?.duration ?? audio?.duration,
      hasThumb: Array.isArray(doc.thumbs) && doc.thumbs.length > 0,
      ...(silent ? { silent: true } : {}),
    };
  }

  if (cls === "MessageMediaGeo" || cls === "MessageMediaGeoLive") {
    return { type: "location", lat: m.geo?.lat, long: m.geo?.long, hasThumb: false };
  }

  if (cls === "MessageMediaPoll") {
    const p = m.poll;
    const question = typeof p?.question === "string" ? p.question : (p?.question?.text ?? "");
    const options = (p?.answers ?? []).map((a: any) =>
      typeof a.text === "string" ? a.text : (a.text?.text ?? ""),
    );
    return { type: "poll", question, options, hasThumb: false };
  }

  if (cls === "MessageMediaContact") {
    const name = [m.firstName, m.lastName].filter(Boolean).join(" ").trim();
    return { type: "contact", fileName: name || "Contact", phone: m.phoneNumber, hasThumb: false };
  }

  return { type: "other", hasThumb: false };
}

function pickLargestPhotoSize(sizes: any[]): { w?: number; h?: number } | undefined {
  let best: any;
  for (const s of sizes) {
    if (s.w && s.h && (!best || s.w * s.h > best.w * best.h)) best = s;
  }
  return best ? { w: best.w, h: best.h } : undefined;
}

/** Display name of a message's sender, best-effort from the attached entity. */
function senderName(msg: any): string {
  const s = msg.sender;
  if (!s) return "Someone";
  if (s.title) return s.title;
  const name = [s.firstName, s.lastName].filter(Boolean).join(" ").trim();
  return name || s.username || "Someone";
}

/** Human-readable summary for a Telegram service (system) message. */
function serviceText(msg: any): string {
  const action = msg.action;
  const who = senderName(msg);
  switch (action?.className) {
    case "MessageActionChatAddUser":
    case "MessageActionChatJoinedByLink":
    case "MessageActionChatJoinedByRequest":
      return `${who} joined the group`;
    case "MessageActionChatDeleteUser":
      return `${who} left the group`;
    case "MessageActionChatCreate":
      return `${who} created the group`;
    case "MessageActionChannelCreate":
      return "Channel created";
    case "MessageActionChatEditTitle":
      return `Group renamed to “${action.title}”`;
    case "MessageActionChatEditPhoto":
      return "Group photo updated";
    case "MessageActionChatDeletePhoto":
      return "Group photo removed";
    case "MessageActionPinMessage":
      return `${who} pinned a message`;
    case "MessageActionChatMigrateTo":
    case "MessageActionChannelMigrateFrom":
      return "Group upgraded to a supergroup";
    case "MessageActionContactSignUp":
      return `${who} joined Telegram`;
    case "MessageActionCustomAction":
      return action.message ?? "";
    case "MessageActionGroupCall":
    case "MessageActionGroupCallScheduled":
      return "Group call";
    default:
      return "";
  }
}

/** Details for a phone/video call service message, or null. */
function callInfo(msg: any): { video: boolean; missed: boolean; duration?: number } | null {
  const action = msg.action;
  if (action?.className !== "MessageActionPhoneCall") return null;
  const reason: string | undefined = action.reason?.className;
  return {
    video: Boolean(action.video),
    missed:
      reason === "PhoneCallDiscardReasonMissed" || reason === "PhoneCallDiscardReasonBusy",
    duration: action.duration ?? undefined,
  };
}

/** Normalize a message's inline/reply keyboard (bots) into plain button rows. */
function normalizeButtons(rm: any): MessageButton[][] | undefined {
  const rows = rm?.rows;
  if (!Array.isArray(rows)) return undefined;
  const out: MessageButton[][] = rows.map((row: any) =>
    (row.buttons ?? []).map((b: any): MessageButton => {
      switch (b.className) {
        case "KeyboardButtonCallback":
          return {
            text: b.text,
            kind: "callback",
            data: Buffer.from(b.data ?? []).toString("base64"),
          };
        case "KeyboardButtonUrl":
        case "KeyboardButtonWebView":
        case "KeyboardButtonSimpleWebView":
          return { text: b.text, kind: "url", url: b.url };
        case "KeyboardButton":
          return { text: b.text, kind: "text" };
        default:
          return { text: b.text ?? "Button", kind: "other" };
      }
    }),
  );
  return out.length ? out : undefined;
}

/** Normalize an Api.Message or Api.MessageService. `chatId` is the marked chat id string. */
const ENTITY_TYPES: Record<string, MessageEntityType> = {
  MessageEntityUrl: "url",
  MessageEntityTextUrl: "text_url",
  MessageEntityEmail: "email",
  MessageEntityMention: "mention",
};

/**
 * Keep the link-ish entities Telegram attached to the message text. Offsets are UTF-16 code
 * units on the wire, which is exactly how JS indexes strings, so they pass through untouched.
 * `text_url` is the one that can't be recovered client-side: its URL isn't in the text at all.
 */
export function normalizeEntities(entities: unknown): MessageEntity[] | undefined {
  if (!Array.isArray(entities)) return undefined;
  const out: MessageEntity[] = [];
  for (const raw of entities) {
    const e = raw as { className?: string; offset?: number; length?: number; url?: string };
    const type = e?.className ? ENTITY_TYPES[e.className] : undefined;
    if (!type || typeof e.offset !== "number" || typeof e.length !== "number") continue;
    if (e.length <= 0) continue;
    out.push({ type, offset: e.offset, length: e.length, ...(e.url ? { url: e.url } : {}) });
  }
  return out.length ? out : undefined;
}

export function normalizeMessage(msg: any, chatId: string): MessageDTO {
  const isService = msg.className === "MessageService";
  const call = callInfo(msg);
  const buttons = isService ? undefined : normalizeButtons(msg.replyMarkup);
  const entities = isService ? undefined : normalizeEntities(msg.entities);
  return {
    id: msg.id,
    chatId,
    senderId: idStr(msg.senderId ?? msg.fromId?.userId ?? null),
    text: isService ? serviceText(msg) : msg.message ?? "",
    date: msg.date ?? 0,
    out: Boolean(msg.out),
    replyToId: msg.replyTo?.replyToMsgId ?? null,
    media: isService ? null : normalizeMediaMeta(msg.media),
    service: isService,
    ...(call ? { call } : {}),
    ...(buttons ? { buttons } : {}),
    ...(entities ? { entities } : {}),
  };
}

export function normalizeMe(me: Api.User): MeDTO {
  return {
    id: String(me.id),
    firstName: me.firstName ?? "",
    lastName: me.lastName ?? undefined,
    username: me.username ?? undefined,
    phone: me.phone ?? undefined,
  };
}
