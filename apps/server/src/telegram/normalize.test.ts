import { describe, it, expect } from "vitest";
import { idStr, normalizeEntities, normalizeMediaMeta, normalizeMessage } from "./normalize";

describe("idStr", () => {
  it("stringifies numbers/bigints and passes through null", () => {
    expect(idStr(123)).toBe("123");
    expect(idStr(null)).toBeNull();
    expect(idStr(undefined)).toBeNull();
  });
});

describe("normalizeMediaMeta", () => {
  it("returns null for no media", () => {
    expect(normalizeMediaMeta(undefined)).toBeNull();
    expect(normalizeMediaMeta(null)).toBeNull();
  });

  it("normalizes a photo and picks the largest size", () => {
    const meta = normalizeMediaMeta({
      className: "MessageMediaPhoto",
      photo: { sizes: [{ w: 100, h: 50 }, { w: 200, h: 100 }] },
    });
    expect(meta).toMatchObject({ type: "photo", width: 200, height: 100, hasThumb: true });
  });

  it("normalizes a video document", () => {
    const meta = normalizeMediaMeta({
      className: "MessageMediaDocument",
      document: {
        mimeType: "video/mp4",
        size: 1024,
        attributes: [{ className: "DocumentAttributeVideo", w: 640, h: 480, duration: 12 }],
        thumbs: [{}],
      },
    });
    expect(meta).toMatchObject({ type: "video", width: 640, duration: 12, hasThumb: true, size: 1024 });
  });

  it("detects a voice note", () => {
    const meta = normalizeMediaMeta({
      className: "MessageMediaDocument",
      document: {
        mimeType: "audio/ogg",
        attributes: [{ className: "DocumentAttributeAudio", voice: true, duration: 3 }],
      },
    });
    expect(meta?.type).toBe("voice");
  });
});

describe("normalizeMessage", () => {
  it("maps core fields", () => {
    const dto = normalizeMessage(
      {
        id: 5,
        message: "hi",
        date: 111,
        out: true,
        senderId: 42,
        replyTo: { replyToMsgId: 3 },
        media: null,
      },
      "-100123",
    );
    expect(dto).toMatchObject({
      id: 5,
      chatId: "-100123",
      text: "hi",
      date: 111,
      out: true,
      senderId: "42",
      replyToId: 3,
      media: null,
    });
    expect(dto.entities).toBeUndefined();
  });

  it("carries link entities through", () => {
    const dto = normalizeMessage(
      {
        id: 6,
        message: "read this",
        entities: [
          { className: "MessageEntityTextUrl", offset: 5, length: 4, url: "https://example.com" },
        ],
      },
      "-100123",
    );
    expect(dto.entities).toEqual([
      { type: "text_url", offset: 5, length: 4, url: "https://example.com" },
    ]);
  });
});

describe("normalizeEntities", () => {
  it("returns undefined for missing or unsupported entities", () => {
    expect(normalizeEntities(undefined)).toBeUndefined();
    expect(normalizeEntities([{ className: "MessageEntityBold", offset: 0, length: 2 }]))
      .toBeUndefined();
  });

  it("keeps urls and emails, dropping malformed spans", () => {
    expect(
      normalizeEntities([
        { className: "MessageEntityUrl", offset: 0, length: 11 },
        { className: "MessageEntityEmail", offset: 20, length: 15 },
        { className: "MessageEntityUrl", offset: 40, length: 0 },
        { className: "MessageEntityUrl", length: 5 },
      ]),
    ).toEqual([
      { type: "url", offset: 0, length: 11 },
      { type: "email", offset: 20, length: 15 },
    ]);
  });
});
