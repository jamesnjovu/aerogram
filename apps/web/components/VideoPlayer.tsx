"use client";

import { useEffect, useRef, useState } from "react";
import { ratio } from "@/lib/media";
import { Spinner } from "./Spinner";

/**
 * Plays a video in place. The player fills whatever box the caller already laid out
 * (the poster card), so starting playback never changes the card's shape, and an
 * overlay reports how much of the stream has buffered while it's still loading.
 *
 * `onAspect` fires once the real dimensions are known — callers that had to guess the
 * card's shape (Telegram doesn't always send them) can correct it from there.
 */
export function VideoPlayer({
  src,
  poster,
  fit = "contain",
  autoPlay = true,
  onAspect,
}: {
  src: string;
  poster?: string;
  fit?: "cover" | "contain";
  autoPlay?: boolean;
  onAspect?: (aspect: string) => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const aspectCb = useRef(onAspect);
  aspectCb.current = onAspect;
  const [percent, setPercent] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Percentage of the clip that has arrived, measured from the buffered ranges.
    const syncProgress = () => {
      const { duration, buffered } = el;
      if (!duration || !Number.isFinite(duration) || buffered.length === 0) {
        setPercent(null);
        return;
      }
      const end = buffered.end(buffered.length - 1);
      setPercent(Math.max(0, Math.min(100, Math.round((end / duration) * 100))));
    };
    const meta = () => {
      const r = ratio(el.videoWidth, el.videoHeight);
      if (r) aspectCb.current?.(r);
      syncProgress();
    };
    const ready = () => {
      setLoading(false);
      syncProgress();
    };
    const stalled = () => setLoading(true);

    const progressEvents = ["progress", "durationchange", "timeupdate"];
    const readyEvents = ["canplay", "playing", "loadeddata"];
    const stalledEvents = ["waiting", "stalled"];

    progressEvents.forEach((e) => el.addEventListener(e, syncProgress));
    readyEvents.forEach((e) => el.addEventListener(e, ready));
    stalledEvents.forEach((e) => el.addEventListener(e, stalled));
    el.addEventListener("loadedmetadata", meta);
    // The element may already be past these events by the time the effect runs.
    if (el.readyState >= 1) meta();
    if (el.readyState >= 3) ready();

    return () => {
      progressEvents.forEach((e) => el.removeEventListener(e, syncProgress));
      readyEvents.forEach((e) => el.removeEventListener(e, ready));
      stalledEvents.forEach((e) => el.removeEventListener(e, stalled));
      el.removeEventListener("loadedmetadata", meta);
    };
  }, [src]);

  return (
    <div className="absolute inset-0 bg-black">
      <video
        ref={ref}
        src={src}
        poster={poster}
        controls
        autoPlay={autoPlay}
        playsInline
        preload="auto"
        className={`h-full w-full ${fit === "cover" ? "object-cover" : "object-contain"}`}
      />
      {loading && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/45">
          <Spinner size={28} />
          <span className="text-xs tabular-nums text-white/90">
            {percent === null ? "Streaming…" : `${percent}%`}
          </span>
        </div>
      )}
    </div>
  );
}
