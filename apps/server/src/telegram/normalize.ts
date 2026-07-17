import { Api } from "telegram";
import type { ChatDTO, ChatType, MediaMeta, MediaType, MessageDTO, MeDTO } from "@wt/shared";

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

function entityType(entity: unknown): ChatType {
  const cls = (entity as { className?: string })?.className;
  if (cls === "Channel") {
    // megagroups (supergroups) are Channels with megagroup=true → treat as group
    return (entity as { megagroup?: boolean }).megagroup ? "group" : "channel";
  }
  if (cls === "Chat" || cls === "ChatForbidden") return "group";
  return "user";
}

function entityTitle(entity: unknown): string {
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
    const fileNameAttr = attrs.find((a) => a.className === "DocumentAttributeFilename");

    let type: MediaType = "document";
    if (sticker) type = "sticker";
    else if (video) type = "video";
    else if (audio) type = audio.voice ? "voice" : "audio";

    const dims = video ?? image;
    return {
      type,
      fileName: fileNameAttr?.fileName,
      mimeType: doc.mimeType,
      size: doc.size !== undefined ? Number(doc.size) : undefined,
      width: dims?.w,
      height: dims?.h,
      duration: video?.duration ?? audio?.duration,
      hasThumb: Array.isArray(doc.thumbs) && doc.thumbs.length > 0,
    };
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

/** Normalize an Api.Message. `chatId` is the marked chat id string, `selfId` the logged-in user's id. */
export function normalizeMessage(msg: any, chatId: string): MessageDTO {
  return {
    id: msg.id,
    chatId,
    senderId: idStr(msg.senderId ?? msg.fromId?.userId ?? null),
    text: msg.message ?? "",
    date: msg.date ?? 0,
    out: Boolean(msg.out),
    replyToId: msg.replyTo?.replyToMsgId ?? null,
    media: normalizeMediaMeta(msg.media),
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
