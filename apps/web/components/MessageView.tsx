"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { DialogsResponse, MessageDTO } from "@aerogram/shared";
import { api, ApiError } from "@/lib/api";
import { MessageBubble } from "./MessageBubble";
import { Composer } from "./Composer";
import { Avatar } from "./Avatar";
import { ChatPicker } from "./ChatPicker";
import { ContactPicker } from "./ContactPicker";
import { chatTypeLabel } from "@/lib/format";

export function MessageView({ chatId }: { chatId: string }) {
  const qc = useQueryClient();

  // The chat may live in any cached dialog list (all-chats or a folder view).
  const dialogCaches = qc.getQueriesData<DialogsResponse>({ queryKey: ["dialogs"] });
  let chat: DialogsResponse["chats"][number] | undefined;
  for (const [, data] of dialogCaches) {
    const found = data?.chats.find((c) => c.id === chatId);
    if (found) {
      chat = found;
      break;
    }
  }

  const [replyTo, setReplyTo] = useState<MessageDTO | null>(null);
  const [editing, setEditing] = useState<MessageDTO | null>(null);
  const [forwarding, setForwarding] = useState<MessageDTO | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  function flash(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice((n) => (n === msg ? null : n)), 2500);
  }

  const query = useInfiniteQuery({
    queryKey: ["messages", chatId],
    queryFn: ({ pageParam }) => api.messages(chatId, pageParam as number),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffsetId ?? undefined,
  });

  const messages = useMemo(() => {
    const all = query.data?.pages.flatMap((p) => p.messages) ?? [];
    return [...all].reverse();
  }, [query.data]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const didInitialScroll = useRef(false);

  useEffect(() => {
    if (!didInitialScroll.current && messages.length > 0) {
      didInitialScroll.current = true;
      bottomRef.current?.scrollIntoView();
    }
  }, [messages.length]);

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

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.deleteMessages(chatId, [id]),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages", chatId] });
      qc.invalidateQueries({ queryKey: ["dialogs"] });
    },
  });

  const forwardMut = useMutation({
    mutationFn: (toChatId: string) => api.forward(chatId, toChatId, [forwarding!.id]),
    onSuccess: () => {
      setForwarding(null);
      flash("Forwarded");
    },
    onError: () => {
      setForwarding(null);
      flash("Couldn’t forward");
    },
  });

  const addMembersMut = useMutation({
    mutationFn: (ids: string[]) => api.addMembers(chatId, ids),
    onSuccess: () => {
      setAddOpen(false);
      qc.invalidateQueries({ queryKey: ["messages", chatId] });
      flash("Members added");
    },
    onError: (e) => {
      setAddOpen(false);
      flash(e instanceof ApiError ? e.message : "Couldn’t add members");
    },
  });

  function handleReply(m: MessageDTO) {
    setEditing(null);
    setReplyTo(m);
  }
  function handleEdit(m: MessageDTO) {
    setReplyTo(null);
    setEditing(m);
  }
  function handleDelete(m: MessageDTO) {
    if (window.confirm("Delete this message?")) deleteMut.mutate(m.id);
  }

  const isGroupish = chat?.type === "group" || chat?.type === "channel";

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-white/10 bg-[#17212b] px-4 py-2.5">
        <Avatar
          chatId={chatId}
          title={chat?.title ?? "Chat"}
          hasPhoto={chat?.hasPhoto ?? false}
          size={40}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{chat?.title ?? "Chat"}</p>
          <p className="truncate text-xs text-slate-400">{chat ? chatTypeLabel(chat.type) : ""}</p>
        </div>
        {isGroupish && (
          <button
            onClick={() => setAddOpen(true)}
            className="rounded-lg px-3 py-1.5 text-sm text-sky-300 hover:bg-sky-500/10"
          >
            ＋ Add
          </button>
        )}
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
          <p className="mt-6 text-center text-sm text-red-300">Couldn’t load messages.</p>
        )}
        {!query.isLoading && messages.length === 0 && (
          <p className="mt-6 text-center text-sm text-slate-500">No messages yet.</p>
        )}
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            chatId={chatId}
            onReply={handleReply}
            onForward={setForwarding}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {notice && (
        <div className="pointer-events-none flex justify-center pb-1">
          <span className="rounded-full bg-black/70 px-3 py-1 text-xs text-white">{notice}</span>
        </div>
      )}

      {chat?.canPost === false ? (
        <div className="border-t border-white/10 bg-[#17212b] px-4 py-4 text-center text-sm text-slate-400">
          You can’t send messages in this channel
        </div>
      ) : (
        <Composer
          chatId={chatId}
          replyTo={replyTo}
          editing={editing}
          onClearReply={() => setReplyTo(null)}
          onClearEdit={() => setEditing(null)}
          onSent={() => bottomRef.current?.scrollIntoView({ behavior: "smooth" })}
        />
      )}

      {forwarding && (
        <ChatPicker
          title="Forward to…"
          onClose={() => setForwarding(null)}
          onPick={(toChatId) => forwardMut.mutate(toChatId)}
        />
      )}

      {addOpen && (
        <ContactPicker
          mode="multi"
          title="Add members"
          confirmLabel="Add"
          busy={addMembersMut.isPending}
          onClose={() => setAddOpen(false)}
          onConfirm={(ids) => addMembersMut.mutate(ids)}
        />
      )}
    </div>
  );
}
