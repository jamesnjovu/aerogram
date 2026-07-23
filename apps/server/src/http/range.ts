export interface ByteRange {
  /** Inclusive first byte. Undefined for suffix ranges. */
  start?: number;
  /** Inclusive last byte. Undefined means "through the end of the file". */
  end?: number;
  /** `bytes=-N` — the final N bytes, which players use to find a trailing MP4 index. */
  suffix?: number;
}

/**
 * Parse a single-range `Range: bytes=…` header. Multi-ranges return null and get the whole
 * file, which is a legal (if unhelpful) answer; no player we care about sends them.
 */
/**
 * Emit exactly `length` bytes starting `skip` bytes into `source`. Telegram only serves
 * aligned chunks, so a range that starts mid-chunk is fetched from the boundary below it and
 * trimmed here — the response body has to be the requested bytes and nothing else, or the
 * player decodes garbage.
 */
export async function* sliceByteRange(
  source: AsyncIterable<Buffer | Uint8Array>,
  skip: number,
  length: number,
): AsyncGenerator<Buffer> {
  let toSkip = skip;
  let left = length;
  if (left <= 0) return;
  for await (const raw of source) {
    let chunk = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
    if (toSkip > 0) {
      if (chunk.length <= toSkip) {
        toSkip -= chunk.length;
        continue;
      }
      chunk = chunk.subarray(toSkip);
      toSkip = 0;
    }
    if (chunk.length >= left) {
      yield chunk.subarray(0, left);
      return;
    }
    left -= chunk.length;
    yield chunk;
  }
}

export function parseByteRange(header: string | undefined): ByteRange | null {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return null;
  const [, rawStart, rawEnd] = m;
  if (rawStart === "") return rawEnd === "" ? null : { suffix: Number(rawEnd) };
  return { start: Number(rawStart), end: rawEnd === "" ? undefined : Number(rawEnd) };
}
