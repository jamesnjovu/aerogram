"use client";

import type { MessageDTO } from "@wt/shared";
import { timeLabel } from "@/lib/format";
import { MediaAttachment } from "./MediaAttachment";

export function MessageBubble({ message, chatId }: { message: MessageDTO; chatId: string }) {
  const out = message.out;
  return (
    <div className={`flex ${out ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-3 py-2 shadow-sm ${
          out
            ? "rounded-br-md bg-sky-600 text-white"
            : "rounded-bl-md bg-slate-700/70 text-slate-100"
        }`}
      >
        {message.media && <MediaAttachment chatId={chatId} message={message} />}
        {message.text && (
          <div className="whitespace-pre-wrap break-words text-[15px] leading-snug">
            {message.text}
          </div>
        )}
        <div
          className={`mt-1 text-right text-[10px] ${
            out ? "text-sky-100/70" : "text-slate-400"
          }`}
        >
          {timeLabel(message.date)}
        </div>
      </div>
    </div>
  );
}
