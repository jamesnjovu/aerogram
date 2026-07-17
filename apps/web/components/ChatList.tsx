"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/store/useAuth";
import { ChatListItem } from "./ChatListItem";

export function ChatList() {
  const router = useRouter();
  const qc = useQueryClient();
  const me = useAuth((s) => s.me);
  const setMe = useAuth((s) => s.setMe);

  const { data, isLoading, error } = useQuery({
    queryKey: ["dialogs"],
    queryFn: () => api.dialogs(),
  });

  const params = useParams<{ id?: string }>();
  const activeId = params?.id ? decodeURIComponent(String(params.id)) : undefined;

  const [q, setQ] = useState("");
  const chats = useMemo(() => {
    const list = data?.chats ?? [];
    const term = q.trim().toLowerCase();
    return term ? list.filter((c) => c.title.toLowerCase().includes(term)) : list;
  }, [data, q]);

  async function logout() {
    try {
      await api.logout();
    } finally {
      setMe(null);
      qc.clear();
      router.replace("/login");
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/10">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {me?.firstName || "Me"}
            {me?.lastName ? ` ${me.lastName}` : ""}
          </p>
          <p className="truncate text-xs text-slate-400">
            {me?.username ? `@${me.username}` : me?.phone ?? ""}
          </p>
        </div>
        <button
          onClick={logout}
          title="Log out"
          className="rounded-md px-2 py-1 text-xs text-slate-300 hover:bg-white/10"
        >
          Log out
        </button>
      </header>

      <div className="px-3 py-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search chats"
          className="w-full rounded-full bg-slate-900/60 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500/30"
        />
      </div>

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
