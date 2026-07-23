"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import type { InviteInfoResponse } from "@aerogram/shared";
import { api, ApiError } from "@/lib/api";
import { parseTelegramLink } from "@/lib/telegramLinks";
import { JoinChatModal } from "@/components/JoinChatModal";

interface PendingInvite {
  hash: string;
  preview: NonNullable<InviteInfoResponse["preview"]>;
}

/**
 * Opens Telegram links inside the app: t.me/<username>, @mentions, t.me/c/… and invite
 * links. Shared by message text and bot keyboard buttons so both behave the same.
 *
 * `open` returns false when the URL isn't an in-app target, leaving the caller to handle
 * it as an ordinary outbound link.
 */
export function useTelegramLink() {
  const router = useRouter();
  const qc = useQueryClient();
  const [pending, setPending] = useState<string | null>(null);
  const [invite, setInvite] = useState<PendingInvite | null>(null);
  const [error, setError] = useState<string | null>(null);

  function flashError(message: string) {
    setError(message);
    setTimeout(() => setError((e) => (e === message ? null : e)), 4000);
  }

  const open = useCallback(
    async (href: string): Promise<boolean> => {
      const target = parseTelegramLink(href);
      if (!target) return false;
      setPending(href);
      try {
        if (target.kind === "internal") {
          router.push(`/chat/${encodeURIComponent(target.chatId)}`);
        } else if (target.kind === "username") {
          const chat = await api.resolveChat(target.username);
          router.push(`/chat/${encodeURIComponent(chat.id)}`);
        } else {
          const info = await api.inviteInfo(target.hash);
          // Already a member → straight in. Otherwise ask before joining anything.
          if (info.chat) router.push(`/chat/${encodeURIComponent(info.chat.id)}`);
          else if (info.preview) setInvite({ hash: target.hash, preview: info.preview });
        }
      } catch (err) {
        // Say why rather than silently bouncing to the browser, then still open the link so
        // the click isn't wasted.
        flashError(
          err instanceof ApiError
            ? `Couldn't open in app: ${err.message}`
            : "Couldn't open that chat in the app.",
        );
        window.open(href, "_blank", "noopener,noreferrer");
      } finally {
        setPending(null);
      }
      return true;
    },
    [router],
  );

  /** Render this somewhere in the component that uses `open`. */
  const overlay = (
    <>
      {invite && (
        <JoinChatModal
          hash={invite.hash}
          preview={invite.preview}
          onJoined={(chat) => {
            setInvite(null);
            qc.invalidateQueries({ queryKey: ["dialogs"] });
            router.push(`/chat/${encodeURIComponent(chat.id)}`);
          }}
          onClose={() => setInvite(null)}
        />
      )}
      {error && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full bg-black/80 px-4 py-2 text-xs text-white shadow-lg">
          {error}
        </div>
      )}
    </>
  );

  return { open, pending, overlay };
}
