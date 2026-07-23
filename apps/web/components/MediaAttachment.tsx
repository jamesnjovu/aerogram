"use client";

import { useState } from "react";
import type { MessageDTO } from "@aerogram/shared";
import { mediaUrl } from "@/lib/api";
import { fileSize } from "@/lib/format";
import { useDownload } from "@/lib/download";
import { cardWidth, FALLBACK_VIDEO_ASPECT, ratio } from "@/lib/media";
import { Spinner } from "./Spinner";
import { VideoPlayer } from "./VideoPlayer";
import { MediaLightbox } from "./MediaLightbox";

/** Corner download button with progress (fetches + saves the file). */
function DownloadButton({
  url,
  filename,
  className = "",
}: {
  url: string;
  filename: string;
  className?: string;
}) {
  const { progress, start } = useDownload();
  const active = progress !== null;
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!active) void start(url, filename);
      }}
      title="Download"
      aria-label="Download"
      className={`flex h-8 min-w-8 items-center justify-center rounded-full bg-black/55 px-1 text-sm text-white backdrop-blur transition hover:bg-black/80 ${className}`}
    >
      {active ? (
        progress >= 0 ? (
          <span className="text-[10px] tabular-nums">{progress}%</span>
        ) : (
          <Spinner size={14} />
        )
      ) : (
        "⬇"
      )}
    </button>
  );
}

/** Corner button that opens the media in the fullscreen viewer. */
function ExpandButton({ onClick }: { onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      onClick={onClick}
      title="Fullscreen"
      aria-label="Fullscreen"
      className="flex h-8 min-w-8 items-center justify-center rounded-full bg-black/55 px-1 text-sm text-white backdrop-blur transition hover:bg-black/80"
    >
      ⛶
    </button>
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
  const [imgLoaded, setImgLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);
  // Learned shape for videos Telegram sent without dimensions: the thumbnail matches the
  // video's aspect, so the card is already correct by the time you hit play.
  const [learnedAspect, setLearnedAspect] = useState<string>();
  const fileDl = useDownload();
  if (!media) return null;

  const full = mediaUrl(chatId, message.id, {});
  const thumb = mediaUrl(chatId, message.id, { thumb: true });
  const download = mediaUrl(chatId, message.id, { download: true });
  const aspect = ratio(media.width, media.height) ?? learnedAspect;

  /* -------------------------------- Photo -------------------------------- */
  if (media.type === "photo") {
    return (
      <div
        className={`group relative mb-1 w-fit max-w-full ${imgLoaded ? "" : "min-h-[140px] min-w-[140px]"}`}
      >
        <button type="button" onClick={() => setExpanded(true)} className="block" title="Open">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={full}
            alt="photo"
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgLoaded(true)}
            className={`block max-h-80 max-w-full rounded-lg object-cover transition-opacity ${
              imgLoaded ? "opacity-100" : "opacity-0"
            }`}
            style={{ aspectRatio: aspect }}
          />
        </button>
        {!imgLoaded && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-slate-800/50">
            <Spinner />
          </div>
        )}
        <DownloadButton url={download} filename={media.fileName ?? "photo.jpg"} className="absolute right-2 top-2" />
        {expanded && (
          <MediaLightbox
            item={{ kind: "photo", src: full, title: media.fileName }}
            onClose={() => setExpanded(false)}
          />
        )}
      </div>
    );
  }

  /* -------------------------------- Video -------------------------------- */
  if (media.type === "video") {
    const box = "relative mb-1 overflow-hidden rounded-lg";
    const boxStyle = {
      width: cardWidth(aspect),
      maxWidth: "100%",
      aspectRatio: aspect ?? FALLBACK_VIDEO_ASPECT,
    };
    const lightbox = expanded && (
      <MediaLightbox
        item={{
          kind: "video",
          src: full,
          poster: media.hasThumb ? thumb : undefined,
          aspect,
          silent: media.silent,
          title: media.fileName,
        }}
        onClose={() => setExpanded(false)}
      />
    );
    // The player mounts inside the very same box as the poster, so the card keeps its shape.
    if (playing) {
      return (
        <>
          <div className={`${box} bg-black`} style={boxStyle}>
            <VideoPlayer
              src={full}
              poster={media.hasThumb ? thumb : undefined}
              silent={media.silent}
              onAspect={setLearnedAspect}
            />
            <div className="absolute right-2 top-2 flex gap-1.5">
              <ExpandButton
                onClick={() => {
                  setPlaying(false); // avoid two copies playing at once
                  setExpanded(true);
                }}
              />
              <DownloadButton url={download} filename={media.fileName ?? "video.mp4"} />
            </div>
          </div>
          {lightbox}
        </>
      );
    }
    return (
      <>
        <div
          className={`group cursor-pointer bg-black/40 ${box}`}
          style={boxStyle}
          onClick={() => setPlaying(true)}
        >
          {media.hasThumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumb}
              alt="video"
              loading="lazy"
              onLoad={(e) => {
                setImgLoaded(true);
                const r = ratio(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight);
                if (r) setLearnedAspect(r);
              }}
              onError={() => setImgLoaded(true)}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-4xl">🎬</div>
          )}
          {media.hasThumb && !imgLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <Spinner />
            </div>
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
          <div className="absolute right-2 top-2 flex gap-1.5">
            <ExpandButton
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(true);
              }}
            />
            <DownloadButton url={download} filename={media.fileName ?? "video.mp4"} />
          </div>
        </div>
        {lightbox}
      </>
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

  /* ------------------------------- Location ------------------------------ */
  if (media.type === "location" && media.lat != null && media.long != null) {
    const url = `https://www.openstreetmap.org/?mlat=${media.lat}&mlon=${media.long}#map=15/${media.lat}/${media.long}`;
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="mb-1 flex items-center gap-3 rounded-lg bg-black/20 px-3 py-2 transition hover:bg-black/30"
      >
        <span className="text-xl">📍</span>
        <span className="min-w-0">
          <span className="block text-sm">Location</span>
          <span className="block truncate text-xs text-slate-400">
            {media.lat.toFixed(5)}, {media.long.toFixed(5)}
          </span>
        </span>
      </a>
    );
  }

  /* --------------------------------- Poll -------------------------------- */
  if (media.type === "poll") {
    return (
      <div className="mb-1 rounded-lg bg-black/20 p-3">
        <p className="mb-1 text-xs text-slate-400">📊 Poll</p>
        <p className="mb-2 font-medium">{media.question}</p>
        <ul className="space-y-1">
          {media.options?.map((o, i) => (
            <li key={i} className="rounded-md border border-white/10 px-2 py-1 text-sm">
              {o}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  /* ------------------------------- Contact ------------------------------- */
  if (media.type === "contact") {
    return (
      <div className="mb-1 flex items-center gap-3 rounded-lg bg-black/20 px-3 py-2">
        <span className="text-xl">👤</span>
        <span className="min-w-0">
          <span className="block truncate text-sm">{media.fileName}</span>
          <span className="block truncate text-xs text-slate-400">{media.phone ?? ""}</span>
        </span>
      </div>
    );
  }

  /* --------------------------- File / audio / voice ---------------------- */
  const active = fileDl.progress !== null;
  const label =
    active && fileDl.progress! >= 0
      ? `Downloading ${fileDl.progress}%`
      : active
        ? "Preparing…"
        : [media.mimeType, fileSize(media.size)].filter(Boolean).join(" · ");
  return (
    <button
      onClick={() => !active && void fileDl.start(download, media.fileName ?? "file")}
      className="mb-1 flex w-full items-center gap-3 rounded-lg bg-black/20 px-3 py-2 text-left transition hover:bg-black/30 disabled:opacity-80"
      disabled={active}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-500/80 text-lg">
        {active ? <Spinner size={18} /> : "⬇"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{media.fileName ?? media.type}</span>
        <span className="block text-xs text-slate-400">{label}</span>
        {active && fileDl.progress! >= 0 && (
          <span className="mt-1 block h-1 w-full overflow-hidden rounded bg-white/10">
            <span
              className="block h-full bg-sky-400 transition-all"
              style={{ width: `${fileDl.progress}%` }}
            />
          </span>
        )}
      </span>
    </button>
  );
}
