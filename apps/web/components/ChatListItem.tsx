"use client";

import Link from "next/link";
import type { ChatDTO } from "@wt/shared";
import { Avatar } from "./Avatar";
import { dayLabel } from "@/lib/format";

export function ChatListItem({ chat, active }: { chat: ChatDTO; active: boolean }) {
  return (
    <Link
      href={`/chat/${encodeURIComponent(chat.id)}`}
      className={`flex items-center gap-3 px-3 py-2.5 transition ${
        active ? "bg-sky-600/25" : "hover:bg-white/5"
      }`}
    >
      <Avatar chatId={chat.id} title={chat.title} hasPhoto={chat.hasPhoto} size={50} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate font-medium">{chat.title}</span>
          <span className="shrink-0 text-[11px] text-slate-400">
            {chat.lastMessage ? dayLabel(chat.lastMessage.date) : ""}
          </span>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <span className="truncate text-sm text-slate-400">
            {chat.lastMessage?.text ?? ""}
          </span>
          {chat.unreadCount > 0 && (
            <span className="shrink-0 rounded-full bg-sky-500 px-1.5 py-0.5 text-[11px] font-semibold text-white">
              {chat.unreadCount > 999 ? "999+" : chat.unreadCount}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
