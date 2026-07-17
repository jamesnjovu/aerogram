"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function Composer({ chatId, onSent }: { chatId: string; onSent?: () => void }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");

  const mutation = useMutation({
    mutationFn: (t: string) => api.send(chatId, t),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["messages", chatId] });
      qc.invalidateQueries({ queryKey: ["dialogs"] });
      onSent?.();
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (t && !mutation.isPending) mutation.mutate(t);
  }

  return (
    <form
      onSubmit={submit}
      className="flex items-end gap-2 border-t border-white/10 bg-[#17212b] p-3"
    >
      <textarea
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
        disabled={mutation.isPending || !text.trim()}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white transition hover:bg-sky-400 disabled:opacity-40"
        aria-label="Send"
      >
        ➤
      </button>
    </form>
  );
}
