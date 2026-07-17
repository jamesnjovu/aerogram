"use client";

import { useState } from "react";
import type { MessageDTO } from "@aerogram/shared";
import { mediaUrl } from "@/lib/api";
import { fileSize } from "@/lib/format";

function DownloadButton({ href, className = "" }: { href: string; className?: string }) {
  return (
    <a
      href={href}
      onClick={(e) => e.stopPropagation()}
      title="Download"
      aria-label="Download"
      className={`flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-sm text-white backdrop-blur transition hover:bg-black/80 ${className}`}
    >
      ⬇
    </a>
  );
}

function durationLabel(seconds?: number): string {
  if (!seconds && seconds !== 0) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function MediaAttachment({ chatId, message }: { chatId: string; message: MessageDTO }) {
  const media = message.media;
  const [playing, setPlaying] = useState(false);
  if (!media) return null;

  const full = mediaUrl(chatId, message.id, {});
  const thumb = mediaUrl(chatId, message.id, { thumb: true });
  const download = mediaUrl(chatId, message.id, { download: true });
  const aspect = media.width && media.height ? `${media.width} / ${media.height}` : undefined;

  /* -------------------------------- Photo -------------------------------- */
  if (media.type === "photo") {
    return (
      <div className="group relative mb-1 w-fit max-w-full">
        <a href={full} target="_blank" rel="noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={full}
            alt="photo"
            loading="lazy"
            className="max-h-80 max-w-full rounded-lg object-cover"
            style={{ aspectRatio: aspect }}
          />
        </a>
        <DownloadButton href={download} className="absolute right-2 top-2" />
      </div>
    );
  }

  /* -------------------------------- Video -------------------------------- */
  if (media.type === "video") {
    if (playing) {
      return (
        <div className="relative mb-1 w-fit max-w-full">
          <video
            src={full}
            controls
            autoPlay
            className="max-h-80 max-w-full rounded-lg bg-black"
            style={{ aspectRatio: aspect }}
          />
          <DownloadButton href={download} className="absolute right-2 top-2" />
        </div>
      );
    }
    return (
      <div
        className="group relative mb-1 w-full max-w-sm cursor-pointer overflow-hidden rounded-lg bg-black/40"
        style={{ aspectRatio: aspect ?? "16 / 9", maxHeight: "24rem" }}
        onClick={() => setPlaying(true)}
      >
        {media.hasThumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt="video"
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl">🎬</div>
        )}
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/55 text-3xl text-white transition group-hover:bg-black/70">
            ▶
          </span>
        </span>
        {media.duration ? (
          <span className="absolute bottom-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-white">
            {durationLabel(media.duration)}
          </span>
        ) : null}
        <DownloadButton href={download} className="absolute right-2 top-2" />
      </div>
    );
  }

  /* ------------------------------- Sticker ------------------------------- */
  if (media.type === "sticker" && media.hasThumb) {
    return (
      <a href={full} target="_blank" rel="noreferrer" className="mb-1 block w-fit">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumb}
          alt="sticker"
          loading="lazy"
          className="max-h-40 max-w-[160px] object-contain"
          style={{ aspectRatio: aspect }}
        />
      </a>
    );
  }

  /* --------------------------- File / audio / voice ---------------------- */
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
