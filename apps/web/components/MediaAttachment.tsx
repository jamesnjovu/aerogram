"use client";

import type { MessageDTO } from "@wt/shared";
import { mediaUrl } from "@/lib/api";
import { fileSize } from "@/lib/format";

export function MediaAttachment({ chatId, message }: { chatId: string; message: MessageDTO }) {
  const media = message.media;
  if (!media) return null;

  const full = mediaUrl(chatId, message.id, {});
  const thumb = mediaUrl(chatId, message.id, { thumb: true });
  const aspect =
    media.width && media.height ? `${media.width} / ${media.height}` : undefined;

  // Photos render inline at full quality.
  if (media.type === "photo") {
    return (
      <a href={full} target="_blank" rel="noreferrer" className="mb-1 block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={full}
          alt="photo"
          loading="lazy"
          className="max-h-80 max-w-full rounded-lg object-cover"
          style={{ aspectRatio: aspect }}
        />
      </a>
    );
  }

  // Videos and stickers show a thumbnail preview linking to the full file.
  if ((media.type === "video" || media.type === "sticker") && media.hasThumb) {
    return (
      <a href={full} target="_blank" rel="noreferrer" className="relative mb-1 block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumb}
          alt={media.type}
          loading="lazy"
          className="max-h-80 max-w-full rounded-lg object-cover"
          style={{ aspectRatio: aspect }}
        />
        {media.type === "video" && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/55 text-xl text-white">
              ▶
            </span>
          </span>
        )}
      </a>
    );
  }

  // Everything else: a downloadable file card.
  const download = mediaUrl(chatId, message.id, { download: true });
  return (
    <a
      href={download}
      className="mb-1 flex items-center gap-3 rounded-lg bg-black/20 px-3 py-2 transition hover:bg-black/30"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-500/80 text-lg">
        ⬇
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm">{media.fileName ?? media.type}</span>
        <span className="block text-xs text-slate-400">
          {[media.mimeType, fileSize(media.size)].filter(Boolean).join(" · ")}
        </span>
      </span>
    </a>
  );
}
