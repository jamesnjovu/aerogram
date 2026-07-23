import type { MessageEntity } from "@aerogram/shared";

export interface TextSegment {
  kind: "text";
  text: string;
}

export interface LinkSegment {
  kind: "link";
  /** What the user sees. */
  text: string;
  /** Where it goes — already validated to a safe scheme. */
  href: string;
}

export type Segment = TextSegment | LinkSegment;

/** Schemes we're willing to put in an href. Anything else renders as plain text. */
const SAFE_SCHEMES = ["http:", "https:", "mailto:", "tel:"];

/**
 * Resolve a raw link to a safe absolute URL, or null if it isn't one. Bare hosts (`example.com`,
 * `www.example.com`) get https://, and unknown schemes — `javascript:` above all — are refused.
 */
export function safeHref(raw: string): string | null {
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    return SAFE_SCHEMES.includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * URLs, emails and @mentions sitting in plain text — messages Telegram didn't mark up, and
 * the local echo of one you just sent. Order matters: the email branch is tried before the
 * mention branch so `a@example.com` isn't read as a mention of `@example`.
 */
const AUTO_LINK =
  /(?:https?:\/\/|www\.)[^\s]+|[\w.+-]+@[\w-]+(?:\.[\w-]+)+|(?<![\w@/])@[a-z][a-z0-9_]{3,31}\b/gi;

/** A @username points at a chat; give it a t.me href so it opens in-app like any other. */
function mentionHref(handle: string): string {
  return `https://t.me/${handle.replace(/^@/, "")}`;
}

/**
 * Trailing punctuation usually belongs to the sentence, not the link: "see example.com." and
 * "(see example.com)" should both stop at `com`. A closing paren only counts as part of the
 * link when the link opened it, as in a Wikipedia URL.
 */
function trimTrailingPunctuation(match: string): string {
  let end = match.length;
  while (end > 0) {
    const ch = match[end - 1];
    if (".,;:!?'\"".includes(ch)) {
      end--;
      continue;
    }
    if (ch === ")") {
      const slice = match.slice(0, end);
      const opened = (slice.match(/\(/g) ?? []).length;
      const closed = (slice.match(/\)/g) ?? []).length;
      if (closed > opened) {
        end--;
        continue;
      }
    }
    break;
  }
  return match.slice(0, end);
}

function autoLink(text: string, push: (segment: Segment) => void): void {
  let cursor = 0;
  for (const match of text.matchAll(AUTO_LINK)) {
    const raw = trimTrailingPunctuation(match[0]);
    const start = match.index ?? 0;
    const href = raw.startsWith("@")
      ? mentionHref(raw)
      : safeHref(raw.includes("@") && !raw.includes("/") ? `mailto:${raw}` : raw);
    if (!href) continue;
    if (start > cursor) push({ kind: "text", text: text.slice(cursor, start) });
    push({ kind: "link", text: raw, href });
    cursor = start + raw.length;
  }
  if (cursor < text.length) push({ kind: "text", text: text.slice(cursor) });
}

/**
 * Split message text into plain and link segments. Telegram's entities win where present —
 * they're authoritative, and `text_url` links have no URL in the text to find — and the gaps
 * between them are scanned for bare URLs.
 */
export function linkify(text: string, entities?: MessageEntity[]): Segment[] {
  const segments: Segment[] = [];
  const push = (segment: Segment) => {
    const last = segments[segments.length - 1];
    // Merge adjacent text runs so consumers get one node per visual chunk.
    if (segment.kind === "text" && last?.kind === "text") last.text += segment.text;
    else segments.push(segment);
  };

  const spans = (entities ?? [])
    .filter((e) => e.offset >= 0 && e.length > 0 && e.offset + e.length <= text.length)
    .sort((a, b) => a.offset - b.offset);

  let cursor = 0;
  for (const span of spans) {
    if (span.offset < cursor) continue; // overlapping markup: first one wins
    if (span.offset > cursor) autoLink(text.slice(cursor, span.offset), push);

    const label = text.slice(span.offset, span.offset + span.length);
    const target = span.type === "text_url" ? (span.url ?? label) : label;
    const href =
      span.type === "mention"
        ? mentionHref(label)
        : safeHref(span.type === "email" ? `mailto:${target}` : target);
    push(href ? { kind: "link", text: label, href } : { kind: "text", text: label });
    cursor = span.offset + span.length;
  }
  if (cursor < text.length) autoLink(text.slice(cursor), push);

  return segments;
}
