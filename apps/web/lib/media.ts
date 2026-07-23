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

/** Numeric width/height from an `aspect-ratio` string. */
function aspectValue(aspect: string | undefined): number | undefined {
  if (!aspect) return undefined;
  const [w, h] = aspect.split("/").map((n) => Number(n.trim()));
  return w > 0 && h > 0 ? w / h : undefined;
}

const MAX_CARD_W = 384; // 24rem
const MAX_CARD_H = 384;
const MIN_CARD_W = 200; // a very tall clip shouldn't end up a sliver

/**
 * Definite pixel width for a media card, chosen so the card fills the height budget without
 * exceeding the width one. Chat bubbles are `w-fit`, and a video card's contents are
 * absolutely positioned, so a percentage width collapses the box to nothing — it has to
 * carry its own size. Pair it with `maxWidth: "100%"` so narrow screens can still shrink it.
 */
export function cardWidth(aspect: string | undefined): number {
  const ar = aspectValue(aspect) ?? aspectValue(FALLBACK_VIDEO_ASPECT)!;
  return Math.round(Math.max(MIN_CARD_W, Math.min(MAX_CARD_W, MAX_CARD_H * ar)));
}
