import { describe, it, expect } from "vitest";
import { encrypt, decrypt } from "./encryption";

describe("encryption (AES-256-GCM)", () => {
  it("round-trips a session string", () => {
    const secret = "1AaBbCc-fake-session-string-0123456789";
    expect(decrypt(encrypt(secret))).toBe(secret);
  });

  it("uses a fresh IV so ciphertext differs each time", () => {
    expect(encrypt("same")).not.toBe(encrypt("same"));
  });

  it("fails to decrypt tampered data", () => {
    const blob = encrypt("payload");
    const tampered = Buffer.from(blob, "base64");
    tampered[tampered.length - 1] ^= 0xff;
    expect(() => decrypt(tampered.toString("base64"))).toThrow();
  });
});
