"use client";

import { useEffect, useRef, useState } from "react";
import { ratio } from "@/lib/media";
import { Spinner } from "./Spinner";

/**
 * Whether the file actually carries an audio track. Browsers disagree on how to tell,
 * and `null` means "can't know yet" — never treat that as silence.
 */
function probeAudio(el: HTMLVideoElement): boolean | null {
  const v = el as HTMLVideoElement & {
    mozHasAudio?: boolean;
    audioTracks?: { length: number };
    webkitAudioDecodedByteCount?: number;
  };
  if (typeof v.mozHasAudio === "boolean") return v.mozHasAudio;
  if (v.audioTracks) return v.audioTracks.length > 0;
  if (typeof v.webkitAudioDecodedByteCount === "number") {
    // Chrome only counts bytes once it decodes audio, and it decodes none while muted,
    // so a zero count only means "silent" after unmuted playback has actually advanced.
    if (v.webkitAudioDecodedByteCount > 0) return true;
    return !el.muted && el.currentTime > 0.6 ? false : null;
  }
  return null;
}

const badge =
  "absolute left-1/2 top-2 -translate-x-1/2 flex items-center gap-1 whitespace-nowrap " +
  "rounded-full bg-black/75 px-3 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur";

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
  silent = false,
  onAspect,
}: {
  src: string;
  poster?: string;
  fit?: "cover" | "contain";
  autoPlay?: boolean;
  /** Telegram already told us this file has no audio track (GIF or `nosound`). */
  silent?: boolean;
  onAspect?: (aspect: string) => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const aspectCb = useRef(onAspect);
  aspectCb.current = onAspect;
  const [percent, setPercent] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [mutedByPolicy, setMutedByPolicy] = useState(false);
  const [detectedSilent, setDetectedSilent] = useState(false);
  const noAudio = silent || detectedSilent;

  // Start playback ourselves rather than via the autoplay attribute: when the browser
  // refuses audible autoplay we can retry muted and offer a one-tap unmute, instead of
  // silently ending up with no playback (Chrome) or no sound (Safari).
  useEffect(() => {
    const el = ref.current;
    if (!el || !autoPlay) return;
    el.muted = false;
    void el.play().catch(() => {
      const retry = ref.current;
      if (!retry) return;
      retry.muted = true;
      setMutedByPolicy(true);
      void retry.play().catch(() => {});
    });
  }, [src, autoPlay]);

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
    const checkAudio = () => {
      const hasAudio = probeAudio(el);
      if (hasAudio !== null) setDetectedSilent(!hasAudio);
    };
    const tick = () => {
      syncProgress();
      checkAudio();
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
    // The user can also unmute through the native controls.
    const volume = () => setMutedByPolicy((was) => was && el.muted);

    const progressEvents = ["progress", "durationchange"];
    const readyEvents = ["canplay", "playing", "loadeddata"];
    const stalledEvents = ["waiting", "stalled"];

    progressEvents.forEach((e) => el.addEventListener(e, syncProgress));
    readyEvents.forEach((e) => el.addEventListener(e, ready));
    stalledEvents.forEach((e) => el.addEventListener(e, stalled));
    el.addEventListener("timeupdate", tick);
    el.addEventListener("volumechange", volume);
    el.addEventListener("loadedmetadata", meta);
    // The element may already be past these events by the time the effect runs.
    if (el.readyState >= 1) meta();
    if (el.readyState >= 3) ready();

    return () => {
      progressEvents.forEach((e) => el.removeEventListener(e, syncProgress));
      readyEvents.forEach((e) => el.removeEventListener(e, ready));
      stalledEvents.forEach((e) => el.removeEventListener(e, stalled));
      el.removeEventListener("timeupdate", tick);
      el.removeEventListener("volumechange", volume);
      el.removeEventListener("loadedmetadata", meta);
    };
  }, [src]);

  function enableSound(e: React.MouseEvent) {
    e.stopPropagation();
    const el = ref.current;
    if (!el) return;
    el.muted = false;
    el.volume = 1;
    setMutedByPolicy(false);
    void el.play().catch(() => {});
  }

  return (
    <div className="absolute inset-0 bg-black">
      <video
        ref={ref}
        src={src}
        poster={poster}
        controls
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
      {mutedByPolicy && !noAudio ? (
        <button onClick={enableSound} className={`${badge} transition hover:bg-black/90`}>
          🔇 Tap for sound
        </button>
      ) : noAudio ? (
        <span
          className={`${badge} pointer-events-none bg-black/60 font-normal text-white/70`}
          title="This video has no audio track"
        >
          🔇 No audio
        </span>
      ) : null}
    </div>
  );
}
