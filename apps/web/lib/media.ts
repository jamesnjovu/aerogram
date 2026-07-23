/** CSS `aspect-ratio` string, or undefined when the dimensions are missing or bogus. */
export function ratio(width?: number, height?: number): string | undefined {
  if (!width || !height || width <= 0 || height <= 0) return undefined;
  return `${width} / ${height}`;
}

/**
 * Telegram omits DocumentAttributeVideo dimensions on some videos (and on most GIFs).
 * Those cards fall back to this until the thumbnail — or the video's own metadata —
 * tells us the real shape, so a card never collapses or jumps when playback starts.
 */
export const FALLBACK_VIDEO_ASPECT = "16 / 9";
