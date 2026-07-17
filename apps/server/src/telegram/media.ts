import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { type TelegramClient } from "telegram";
import { config } from "../config";
import { normalizeMediaMeta } from "./normalize";
import { getMessageById } from "./messages";
import { resolveInputPeer } from "./entityCache";

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

  const data = await client.downloadMedia(
    msg,
    thumb ? { thumb: pickLargestThumb(msg) as never } : {},
  );
  const buffer = toBuffer(data);
  if (!buffer) return null;

  const result: DownloadResult = { buffer, ...describe(msg, thumb) };
  writeCache(key, result);
  return result;
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
