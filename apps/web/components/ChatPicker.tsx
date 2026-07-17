"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Avatar } from "./Avatar";

/** Pick a single destination chat (used for forwarding). */
export function ChatPicker({
  title,
  onClose,
  onPick,
}: {
  title: string;
  onClose: () => void;
  onPick: (chatId: string) => void;
}) {
  const { data, isLoading } = useQuery({ queryKey: ["dialogs", 0], queryFn: () => api.dialogs(0) });
  const [q, setQ] = useState("");

  const chats = useMemo(() => {
    const list = data?.chats ?? [];
    const term = q.trim().toLowerCase();
    return term ? list.filter((c) => c.title.toLowerCase().includes(term)) : list;
  }, [data, q]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative flex max-h-[80vh] w-full max-w-sm flex-col rounded-2xl bg-[#17212b] shadow-2xl">
        <div className="p-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <input
            className="mt-3 w-full rounded-full bg-slate-900/60 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500/30"
            placeholder="Search chats"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
        </div>
        <div className="flex-1 overflow-y-auto pb-2">
          {isLoading && <p className="p-4 text-center text-sm text-slate-500">Loading…</p>}
          {chats.map((c) => (
            <button
              key={c.id}
              onClick={() => onPick(c.id)}
              className="flex w-full items-center gap-3 px-4 py-2 text-left transition hover:bg-white/5"
            >
              <Avatar chatId={c.id} title={c.title} hasPhoto={c.hasPhoto} size={40} />
              <span className="truncate text-sm">{c.title}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
