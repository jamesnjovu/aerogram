"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { VideoPlayer } from "./VideoPlayer";
import { Spinner } from "./Spinner";
import { FALLBACK_VIDEO_ASPECT } from "@/lib/media";

export interface LightboxItem {
  kind: "photo" | "video";
  /** Full-size media URL. */
  src: string;
  /** Poster/thumbnail URL (videos). */
  poster?: string;
  /** CSS aspect-ratio for the video box, when known. */
  aspect?: string;
  /** Video known to have no audio track. */
  silent?: boolean;
  title?: string;
}

const iconButton =
  "flex h-9 min-w-9 items-center justify-center rounded-full bg-black/60 px-2 text-sm " +
  "text-white backdrop-blur transition hover:bg-black/80";

/**
 * Full-screen media viewer. Opens as an overlay over the app, and the ⛶ button hands the
 * overlay to the browser's Fullscreen API so photos get real fullscreen too (videos have it
 * in their own controls, but this keeps both media types behaving the same).
 */
export function MediaLightbox({ item, onClose }: { item: LightboxItem; onClose: () => void }) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [aspect, setAspect] = useState(item.aspect);
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // In fullscreen, Esc belongs to the browser (it exits fullscreen first).
      if (e.key === "Escape" && !document.fullscreenElement) onClose();
    };
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));

    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.body.style.overflow = previousOverflow;
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    };
  }, [onClose]);

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void shellRef.current?.requestFullscreen?.().catch(() => {});
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={shellRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      // Portals still bubble through the React tree — don't let clicks reach the card behind.
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={item.title ?? "Media viewer"}
    >
      <div
        className="absolute right-3 top-3 z-10 flex gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={toggleFullscreen}
          className={iconButton}
          title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? "⤡" : "⛶"}
        </button>
        <button onClick={onClose} className={iconButton} title="Close" aria-label="Close">
          ✕
        </button>
      </div>

      {item.title && !isFullscreen && (
        <p className="absolute left-4 top-5 max-w-[60%] truncate text-sm text-white/80">
          {item.title}
        </p>
      )}

      {item.kind === "video" ? (
        <div
          onClick={(e) => e.stopPropagation()}
          className={isFullscreen ? "relative h-full w-full" : "relative w-full max-w-5xl"}
          style={
            isFullscreen
              ? undefined
              : { aspectRatio: aspect ?? FALLBACK_VIDEO_ASPECT, maxHeight: "85vh" }
          }
        >
          <VideoPlayer src={item.src} poster={item.poster} silent={item.silent} onAspect={setAspect} />
        </div>
      ) : (
        <div onClick={(e) => e.stopPropagation()} className="relative flex max-h-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.src}
            alt={item.title ?? "photo"}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgLoaded(true)}
            className={`object-contain transition-opacity ${
              isFullscreen ? "max-h-screen max-w-[100vw]" : "max-h-[88vh] max-w-full"
            } ${imgLoaded ? "opacity-100" : "opacity-0"}`}
          />
          {!imgLoaded && (
            <span className="absolute inset-0 flex items-center justify-center">
              <Spinner size={28} />
            </span>
          )}
        </div>
      )}
    </div>,
    document.body,
  );
}
