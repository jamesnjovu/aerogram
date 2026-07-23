import { describe, it, expect } from "vitest";
import { parseByteRange, sliceByteRange } from "./range";

describe("parseByteRange", () => {
  it("returns null when there is no usable range", () => {
    expect(parseByteRange(undefined)).toBeNull();
    expect(parseByteRange("bytes=-")).toBeNull();
    expect(parseByteRange("bytes=0-100, 200-300")).toBeNull(); // multi-range: serve it whole
    expect(parseByteRange("items=0-100")).toBeNull();
  });

  it("parses a closed range", () => {
    expect(parseByteRange("bytes=0-1023")).toEqual({ start: 0, end: 1023 });
  });

  it("parses an open-ended range", () => {
    expect(parseByteRange("bytes=1048576-")).toEqual({ start: 1048576, end: undefined });
  });

  it("parses a suffix range", () => {
    expect(parseByteRange("bytes=-500")).toEqual({ suffix: 500 });
  });

  it("tolerates surrounding whitespace", () => {
    expect(parseByteRange("  bytes=10-20 ")).toEqual({ start: 10, end: 20 });
  });
});

describe("sliceByteRange", () => {
  const CHUNK = 512 * 1024;
  /** A stand-in for Telegram's download iterator: fixed-size chunks from an aligned offset. */
  async function* chunksFrom(file: Buffer, offset: number): AsyncGenerator<Buffer> {
    for (let i = offset; i < file.length; i += CHUNK) yield file.subarray(i, i + CHUNK);
  }
  async function collect(gen: AsyncIterable<Buffer>): Promise<Buffer> {
    const out: Buffer[] = [];
    for await (const c of gen) out.push(c);
    return Buffer.concat(out);
  }
  /** Byte i = i mod 251, so any misalignment shows up as a value mismatch. */
  const file = Buffer.from(Array.from({ length: 3 * CHUNK + 12345 }, (_, i) => i % 251));

  function served(start: number, end: number) {
    const aligned = start - (start % CHUNK);
    return collect(sliceByteRange(chunksFrom(file, aligned), start - aligned, end - start + 1));
  }

  it("returns exactly the requested bytes for an aligned range", async () => {
    await expect(served(0, CHUNK - 1)).resolves.toEqual(file.subarray(0, CHUNK));
  });

  it("returns exactly the requested bytes when the range starts mid-chunk", async () => {
    const start = CHUNK + 1234;
    const end = start + 100000;
    await expect(served(start, end)).resolves.toEqual(file.subarray(start, end + 1));
  });

  it("handles a range spanning several chunks", async () => {
    const start = 5000;
    const end = 2 * CHUNK + 77;
    const body = await served(start, end);
    expect(body.length).toBe(end - start + 1);
    expect(body).toEqual(file.subarray(start, end + 1));
  });

  it("stops at the end of the file for an open-ended range", async () => {
    const start = 3 * CHUNK;
    const body = await served(start, file.length - 1);
    expect(body).toEqual(file.subarray(start));
  });

  it("emits nothing for an empty range", async () => {
    await expect(collect(sliceByteRange(chunksFrom(file, 0), 0, 0))).resolves.toHaveLength(0);
  });
});
