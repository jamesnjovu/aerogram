export type TelegramTarget =
  /** Public @username — a channel, group, bot or user. Needs resolving to a chat id. */
  | { kind: "username"; username: string }
  /** t.me/c/<internal id>/… — a private channel whose marked id we can build directly. */
  | { kind: "internal"; chatId: string }
  /** t.me/+hash or t.me/joinchat/hash — private chat that may need joining first. */
  | { kind: "invite"; hash: string };

const HOSTS = new Set(["t.me", "www.t.me", "telegram.me", "www.telegram.me", "telegram.dog"]);

/** First path segments that aren't chats at all — those keep opening in the browser. */
const NOT_A_CHAT = new Set([
  "share",
  "addstickers",
  "addemoji",
  "addtheme",
  "addlist",
  "proxy",
  "socks",
  "setlanguage",
  "confirmphone",
  "login",
  "invoice",
  "giftcode",
  "bg",
  "iv",
]);

const USERNAME = /^[a-z][a-z0-9_]{3,31}$/i;

/**
 * Recognise a t.me link that points at a chat we can open in-app. Anything else — invite
 * links, sticker packs, share sheets, other hosts — returns null and stays a normal link.
 */
export function parseTelegramLink(href: string): TelegramTarget | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!HOSTS.has(url.hostname.toLowerCase())) return null;

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length === 0) return null;

  const first = decodeURIComponent(parts[0]);
  if (NOT_A_CHAT.has(first.toLowerCase())) return null;

  // t.me/+<hash> and the older t.me/joinchat/<hash> both carry an invite hash.
  if (first.startsWith("+")) {
    const hash = first.slice(1);
    return hash ? { kind: "invite", hash } : null;
  }
  if (first.toLowerCase() === "joinchat") {
    return parts[1] ? { kind: "invite", hash: decodeURIComponent(parts[1]) } : null;
  }

  if (first.toLowerCase() === "c") {
    // t.me/c/<internal id>/<message id>. A channel's marked id is -(1e12 + raw id) — real
    // arithmetic, not a "-100" prefix, which would be wrong for any id under 10 digits.
    if (!parts[1] || !/^\d+$/.test(parts[1])) return null;
    return { kind: "internal", chatId: `-${1000000000000n + BigInt(parts[1])}` };
  }

  const username = first.startsWith("@") ? first.slice(1) : first;
  return USERNAME.test(username) ? { kind: "username", username } : null;
}
