"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { MessageDTO } from "@aerogram/shared";
import { api } from "@/lib/api";

export function Composer({
  chatId,
  onSent,
  replyTo,
  editing,
  onClearReply,
  onClearEdit,
}: {
  chatId: string;
  onSent?: () => void;
  replyTo?: MessageDTO | null;
  editing?: MessageDTO | null;
  onClearReply?: () => void;
  onClearEdit?: () => void;
}) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  // When an edit starts, prefill the text with the message being edited.
  useEffect(() => {
    if (editing) {
      setText(editing.text);
      taRef.current?.focus();
    }
  }, [editing]);

  const sendMut = useMutation({
    mutationFn: (t: string) => api.send(chatId, t, replyTo?.id ?? undefined),
    onSuccess: () => {
      setText("");
      onClearReply?.();
      qc.invalidateQueries({ queryKey: ["messages", chatId] });
      qc.invalidateQueries({ queryKey: ["dialogs"] });
      onSent?.();
    },
  });

  const editMut = useMutation({
    mutationFn: (t: string) => api.editMessage(chatId, editing!.id, t),
    onSuccess: () => {
      setText("");
      onClearEdit?.();
      qc.invalidateQueries({ queryKey: ["messages", chatId] });
      onSent?.();
    },
  });

  const busy = sendMut.isPending || editMut.isPending;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || busy) return;
    if (editing) editMut.mutate(t);
    else sendMut.mutate(t);
  }

  const preview = editing ?? replyTo;

  return (
    <form onSubmit={submit} className="border-t border-white/10 bg-[#17212b]">
      {preview && (
        <div className="flex items-center gap-2 px-4 pt-2">
          <div className="min-w-0 flex-1 border-l-2 border-sky-500 pl-2 text-xs">
            <p className="text-sky-300">{editing ? "Editing" : "Reply"}</p>
            <p className="truncate text-slate-400">{preview.text || "Media"}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (editing) {
                onClearEdit?.();
                setText("");
              } else {
                onClearReply?.();
              }
            }}
            className="text-slate-400 hover:text-white"
            aria-label="Cancel"
          >
            ✕
          </button>
        </div>
      )}
      <div className="flex items-end gap-2 p-3">
        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit(e);
            }
          }}
          rows={1}
          placeholder="Message"
          className="max-h-40 min-h-[44px] flex-1 resize-none rounded-2xl bg-slate-900/60 px-4 py-3 text-[15px] outline-none focus:ring-2 focus:ring-sky-500/30"
        />
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white transition hover:bg-sky-400 disabled:opacity-40"
          aria-label={editing ? "Save edit" : "Send"}
        >
          {editing ? "✓" : "➤"}
        </button>
      </div>
    </form>
  );
}
