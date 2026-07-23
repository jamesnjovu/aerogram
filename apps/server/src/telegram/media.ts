import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { Readable } from "node:stream";
import bigInt from "big-integer";
import { type TelegramClient } from "telegram";
import { config } from "../config";
import { normalizeMediaMeta } from "./normalize";
import { getMessageById } from "./messages";
import { resolveInputPeer } from "./entityCache";
import { sliceByteRange, type ByteRange } from "../http/range";

const cacheRoot = resolve(config.MEDIA_CACHE_DIR);
mkdirSync(cacheRoot, { recursive: true });

export interface DownloadResult {
  buffer: Buffer;
  contentType: string;
  fileName: string;
}

function keyFor(parts: string): string {
  return createHash("sha1").update(parts).digest("hex");
}

function readCache(key: string): DownloadResult | null {
  const binPath = join(cacheRoot, `${key}.bin`);
  const metaPath = join(cacheRoot, `${key}.json`);
  if (!existsSync(binPath) || !existsSync(metaPath)) return null;
  try {
    const meta = JSON.parse(readFileSync(metaPath, "utf8")) as {
      contentType: string;
      fileName: string;
    };
    return { buffer: readFileSync(binPath), contentType: meta.contentType, fileName: meta.fileName };
  } catch {
    return null;
  }
}

function writeCache(key: string, result: DownloadResult): void {
  try {
    writeFileSync(join(cacheRoot, `${key}.bin`), result.buffer);
    writeFileSync(
      join(cacheRoot, `${key}.json`),
      JSON.stringify({ contentType: result.contentType, fileName: result.fileName }),
    );
  } catch {
    /* cache is best-effort */
  }
}

function toBuffer(data: unknown): Buffer | null {
  if (!data) return null;
  if (Buffer.isBuffer(data)) return data.length ? data : null;
  if (data instanceof Uint8Array) return data.length ? Buffer.from(data) : null;
  return null;
}

function describe(msg: any, thumb: boolean): { contentType: string; fileName: string } {
  if (thumb) return { contentType: "image/jpeg", fileName: "thumb.jpg" };
  const meta = normalizeMediaMeta(msg.media);
  if (!meta) return { contentType: "application/octet-stream", fileName: "file.bin" };
  if (meta.type === "photo") return { contentType: "image/jpeg", fileName: "photo.jpg" };
  return {
    contentType: meta.mimeType ?? "application/octet-stream",
    fileName: meta.fileName ?? "file",
  };
}

/** Pick the largest real thumbnail (skips the tiny stripped/path placeholders). */
function pickLargestThumb(msg: any): unknown {
  const list: any[] = msg?.media?.document?.thumbs ?? msg?.media?.photo?.sizes ?? [];
  let best: any = null;
  for (const t of list) {
    if (t.className === "PhotoStrippedSize" || t.className === "PhotoPathSize") continue;
    const w = t.w ?? (Array.isArray(t.sizes) ? Number.MAX_SAFE_INTEGER : 0);
    if (!best || w > (best.w ?? 0)) best = t;
  }
  return best ?? 0; // fall back to the smallest-index thumb
}

/** Download (and cache) the media attached to a message. thumb=true fetches a preview image. */
export async function downloadForMessage(
  userId: number,
  client: TelegramClient,
  chatId: string,
  messageId: number,
  thumb: boolean,
): Promise<DownloadResult | null> {
  // "t2" cache version — bumped when we switched thumbs from smallest → largest.
  const key = keyFor(`${userId}:${chatId}:${messageId}:${thumb ? "t2" : "f"}`);
  const cached = readCache(key);
  if (cached) return cached;

  const msg = await getMessageById(userId, client, chatId, messageId);
  if (!msg || !(msg as { media?: unknown }).media) return null;

  const data = await client
    .downloadMedia(msg, thumb ? { thumb: pickLargestThumb(msg) as never } : {})
    .catch(() => null);
  let buffer = toBuffer(data);

  // Not every photo carries a thumbnail Telegram will serve. Rather than 404 — which shows
  // up as an empty tile — fall back to the full image, which is what the viewer loads anyway.
  // Documents are left alone: falling back there would mean buffering an entire video.
  const isPhoto = (msg as { media?: { className?: string } }).media?.className === "MessageMediaPhoto";
  if (!buffer && thumb && isPhoto) {
    buffer = toBuffer(await client.downloadMedia(msg, {}).catch(() => null));
  }
  if (!buffer) return null;

  const result: DownloadResult = { buffer, ...describe(msg, thumb) };
  writeCache(key, result);
  return result;
}

export interface StreamResult {
  stream: Readable;
  contentType: string;
  fileName: string;
  size?: number;
  /** Inclusive byte range being served — set only when the caller asked for one. */
  start?: number;
  end?: number;
  /** The requested range lies outside the file; the caller should answer 416. */
  unsatisfiable?: boolean;
}

/**
 * Telegram serves file chunks on aligned offsets only (and a chunk may not straddle a 1 MB
 * boundary), so a range starting mid-chunk is fetched from the boundary below it and the
 * extra head bytes are dropped here.
 */
const CHUNK = 512 * 1024;

/**
 * Stream a document (video/audio/file) straight from Telegram to the client, chunk by chunk,
 * instead of buffering the whole file server-side first. Returns null for non-documents
 * (photos etc.), which fall back to the buffered path.
 *
 * With a `range`, only those bytes are streamed so the caller can answer 206 — media
 * elements need that to seek, and Safari refuses to play without it.
 */
export async function streamMedia(
  userId: number,
  client: TelegramClient,
  chatId: string,
  messageId: number,
  range?: ByteRange | null,
): Promise<StreamResult | null> {
  const msg = await getMessageById(userId, client, chatId, messageId);
  const media = (msg as { media?: any })?.media;
  if (!media || media.className !== "MessageMediaDocument") return null;

  const { contentType, fileName } = describe(msg, false);
  const size = normalizeMediaMeta(media)?.size;

  // No range asked for — or no known size to resolve it against — so serve the whole file.
  if (!range || !size) {
    const iter = (client as any).iterDownload({ file: media, requestSize: CHUNK });
    return { stream: Readable.from(iter), contentType, fileName, size };
  }

  const last = size - 1;
  const start = range.suffix !== undefined ? Math.max(0, size - range.suffix) : (range.start ?? 0);
  const end = range.suffix !== undefined ? last : Math.min(range.end ?? last, last);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > last || end < start) {
    return { stream: Readable.from([]), contentType, fileName, size, unsatisfiable: true };
  }

  const alignedStart = start - (start % CHUNK);
  const iter = (client as any).iterDownload({
    file: media,
    offset: bigInt(alignedStart),
    requestSize: CHUNK,
  });
  const stream = Readable.from(sliceByteRange(iter, start - alignedStart, end - start + 1));
  return { stream, contentType, fileName, size, start, end };
}

/** Download (and cache) a chat's profile photo (small size). */
export async function downloadAvatar(
  userId: number,
  client: TelegramClient,
  chatId: string,
): Promise<DownloadResult | null> {
  const key = keyFor(`${userId}:${chatId}:avatar`);
  const cached = readCache(key);
  if (cached) return cached;

  const peer = await resolveInputPeer(userId, client, chatId);
  const data = await client.downloadProfilePhoto(peer, { isBig: false });
  const buffer = toBuffer(data);
  if (!buffer) return null;

  const result: DownloadResult = { buffer, contentType: "image/jpeg", fileName: "avatar.jpg" };
  writeCache(key, result);
  return result;
}
