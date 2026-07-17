"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { ChatListItem } from "./ChatListItem";
import { SideNav } from "./SideNav";

export function ChatList() {
  const [folderId, setFolderId] = useState(0);

  const { data: foldersData } = useQuery({ queryKey: ["folders"], queryFn: () => api.folders() });
  const folders = foldersData?.folders ?? [];

  const { data, isLoading, error } = useQuery({
    queryKey: ["dialogs", folderId],
    queryFn: () => api.dialogs(folderId),
  });

  const params = useParams<{ id?: string }>();
  const activeId = params?.id ? decodeURIComponent(String(params.id)) : undefined;

  const [q, setQ] = useState("");
  const chats = useMemo(() => {
    const list = data?.chats ?? [];
    const term = q.trim().toLowerCase();
    return term ? list.filter((c) => c.title.toLowerCase().includes(term)) : list;
  }, [data, q]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-white/10 px-3 py-2.5">
        <SideNav />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search chats"
          className="w-full rounded-full bg-slate-900/60 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500/30"
        />
      </header>

      {folders.length > 1 && (
        <div className="flex gap-1 overflow-x-auto border-b border-white/10 px-2 py-1.5">
          {folders.map((f) => (
            <button
              key={f.id}
              onClick={() => setFolderId(f.id)}
              className={`shrink-0 rounded-full px-3 py-1 text-sm transition ${
                folderId === f.id
                  ? "bg-sky-500/25 text-sky-200"
                  : "text-slate-400 hover:bg-white/5"
              }`}
            >
              {f.emoticon ? `${f.emoticon} ` : ""}
              {f.title}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {isLoading && <p className="px-4 py-6 text-center text-sm text-slate-500">Loading chats…</p>}
        {error && (
          <p className="px-4 py-6 text-center text-sm text-red-300">Failed to load chats.</p>
        )}
        {!isLoading && chats.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-slate-500">No chats found.</p>
        )}
        {chats.map((c) => (
          <ChatListItem key={c.id} chat={c} active={c.id === activeId} />
        ))}
      </div>
    </div>
  );
}
