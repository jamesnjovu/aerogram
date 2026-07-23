"use client";

import { useMemo } from "react";
import type { MessageEntity } from "@aerogram/shared";
import { linkify } from "@/lib/linkify";
import { parseTelegramLink } from "@/lib/telegramLinks";
import { useTelegramLink } from "@/lib/useTelegramLink";

/**
 * Message text with its links made clickable. t.me links, @mentions and invite links all
 * open the chat inside the app; everything else is a normal outbound link.
 */
export function RichText({ text, entities }: { text: string; entities?: MessageEntity[] }) {
  const { open, pending, overlay } = useTelegramLink();
  const segments = useMemo(() => linkify(text, entities), [text, entities]);

  return (
    <>
      {segments.map((segment, i) => {
        if (segment.kind !== "link") return <span key={i}>{segment.text}</span>;
        const inApp = parseTelegramLink(segment.href) !== null;
        return (
          <a
            key={i}
            href={segment.href}
            target={inApp ? undefined : "_blank"}
            rel="noopener noreferrer"
            title={segment.href}
            aria-busy={pending === segment.href}
            onClick={(e) => {
              e.stopPropagation();
              // Leave modified clicks (new tab, download, …) to the browser.
              if (!inApp || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
              e.preventDefault();
              void open(segment.href);
            }}
            className={`underline underline-offset-2 transition hover:opacity-80 ${
              pending === segment.href ? "opacity-50" : ""
            }`}
          >
            {segment.text}
          </a>
        );
      })}
      {overlay}
    </>
  );
}
