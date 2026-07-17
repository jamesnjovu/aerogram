"use client";

import { useEffect, useMemo, useRef } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import type { DialogsResponse } from "@wt/shared";
import { api } from "@/lib/api";
import { MessageBubble } from "./MessageBubble";
import { Composer } from "./Composer";
import { Avatar } from "./Avatar";
import { chatTypeLabel } from "@/lib/format";

export function MessageView({ chatId }: { chatId: string }) {
  const qc = useQueryClient();
  const dialogs = qc.getQueryData<DialogsResponse>(["dialogs"]);
  const chat = dialogs?.chats.find((c) => c.id === chatId);

  const query = useInfiniteQuery({
    queryKey: ["messages", chatId],
    queryFn: ({ pageParam }) => api.messages(chatId, pageParam as number),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffsetId ?? undefined,
  });

  // Pages are newest-first; flatten then reverse to show oldest→newest top-to-bottom.
  const messages = useMemo(() => {
    const all = query.data?.pages.flatMap((p) => p.messages) ?? [];
    return [...all].reverse();
  }, [query.data]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const didInitialScroll = useRef(false);

  // Jump to the newest message on first load.
  useEffect(() => {
    if (!didInitialScroll.current && messages.length > 0) {
      didInitialScroll.current = true;
      bottomRef.current?.scrollIntoView();
    }
  }, [messages.length]);

  // Load older messages when scrolled near the top, preserving scroll position.
  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop < 80 && query.hasNextPage && !query.isFetchingNextPage) {
      const prevHeight = el.scrollHeight;
      void query.fetchNextPage().then(() => {
        requestAnimationFrame(() => {
          const el2 = scrollRef.current;
          if (el2) el2.scrollTop = el2.scrollHeight - prevHeight;
        });
      });
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-white/10 bg-[#17212b] px-4 py-2.5">
        <Avatar
          chatId={chatId}
          title={chat?.title ?? "Chat"}
          hasPhoto={chat?.hasPhoto ?? false}
          size={40}
        />
        <div className="min-w-0">
          <p className="truncate font-medium">{chat?.title ?? "Chat"}</p>
          <p className="truncate text-xs text-slate-400">
            {chat ? chatTypeLabel(chat.type) : ""}
          </p>
        </div>
      </header>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex-1 space-y-1.5 overflow-y-auto px-4 py-4"
      >
        {query.isLoading && (
          <p className="mt-6 text-center text-sm text-slate-500">Loading messages…</p>
        )}
        {query.isFetchingNextPage && (
          <p className="text-center text-xs text-slate-500">Loading older…</p>
        )}
        {query.isError && (
          <p className="mt-6 text-center text-sm text-red-300">Couldn&apos;t load messages.</p>
        )}
        {!query.isLoading && messages.length === 0 && (
          <p className="mt-6 text-center text-sm text-slate-500">No messages yet.</p>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} chatId={chatId} />
        ))}
        <div ref={bottomRef} />
      </div>

      <Composer
        chatId={chatId}
        onSent={() => bottomRef.current?.scrollIntoView({ behavior: "smooth" })}
      />
    </div>
  );
}
