"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import type { InviteInfoResponse, ResolveChatResponse } from "@aerogram/shared";
import { api, ApiError } from "@/lib/api";
import { Spinner } from "./Spinner";

type Preview = NonNullable<InviteInfoResponse["preview"]>;

/**
 * Confirmation for an invite link. Following one means *joining* a chat — an action the
 * account can't take back silently — so the click opens this instead of joining outright.
 */
export function JoinChatModal({
  hash,
  preview,
  onJoined,
  onClose,
}: {
  hash: string;
  preview: Preview;
  onJoined: (chat: ResolveChatResponse) => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requested, setRequested] = useState(false);

  async function join() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.joinInvite(hash);
      if (res.chat) onJoined(res.chat);
      else setRequested(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't join this chat.");
    } finally {
      setBusy(false);
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full max-w-sm rounded-2xl bg-[#17212b] p-6 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {requested ? (
          <>
            <p className="mb-1 text-lg font-semibold">Request sent</p>
            <p className="mb-5 text-sm text-slate-400">
              {preview.title} admits members by approval. You&apos;ll join once an admin accepts.
            </p>
            <button
              onClick={onClose}
              className="w-full rounded-lg bg-sky-600 py-2.5 text-sm font-medium transition hover:bg-sky-500"
            >
              Done
            </button>
          </>
        ) : (
          <>
            <p className="mb-1 text-lg font-semibold">{preview.title}</p>
            <p className="mb-5 text-sm text-slate-400">
              {preview.memberCount ? `${preview.memberCount.toLocaleString()} members · ` : ""}
              {preview.requestNeeded
                ? "Joining sends a request for an admin to approve."
                : "You're not in this chat yet."}
            </p>
            {error && <p className="mb-3 text-sm text-red-300">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 rounded-lg bg-white/10 py-2.5 text-sm transition hover:bg-white/15"
              >
                Cancel
              </button>
              <button
                onClick={join}
                disabled={busy}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-sky-600 py-2.5 text-sm font-medium transition hover:bg-sky-500 disabled:opacity-60"
              >
                {busy && <Spinner size={14} />}
                {preview.requestNeeded ? "Send request" : "Join"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
