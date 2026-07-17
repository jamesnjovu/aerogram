import type { ChatType } from "@aerogram/shared";

/** Two-letter initials for an avatar fallback. */
export function initials(title: string): string {
  const parts = title.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** Short time label (HH:MM) for a unix timestamp (seconds). */
export function timeLabel(unixSeconds: number): string {
  if (!unixSeconds) return "";
  return new Date(unixSeconds * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Relative-ish day label for the chat list. */
export function dayLabel(unixSeconds: number): string {
  if (!unixSeconds) return "";
  const d = new Date(unixSeconds * 1000);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return timeLabel(unixSeconds);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { day: "2-digit", month: "short" });
}

/** Human-readable file size. */
export function fileSize(bytes?: number): string {
  if (!bytes && bytes !== 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

/** Deterministic accent color for an avatar, derived from the chat id. */
export function avatarColor(id: string): string {
  const palette = [
    "#e17076", "#7bc862", "#65aadd", "#a695e7",
    "#ee7aae", "#6ec9cb", "#faa774", "#5cacf0",
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return palette[Math.abs(hash) % palette.length];
}

export function chatTypeLabel(type: ChatType): string {
  switch (type) {
    case "channel":
      return "Channel";
    case "group":
      return "Group";
    default:
      return "";
  }
}
