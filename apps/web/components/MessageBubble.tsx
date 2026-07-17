"use client";

import { useState } from "react";
import type { MessageDTO } from "@aerogram/shared";
import { timeLabel } from "@/lib/format";
import { MediaAttachment } from "./MediaAttachment";

function MenuItem({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-white/10 ${
        danger ? "text-red-300" : ""
      }`}
    >
      {children}
    </button>
  );
}

export function MessageBubble({
  message,
  chatId,
  onReply,
  onForward,
  onEdit,
  onDelete,
}: {
  message: MessageDTO;
  chatId: string;
  onReply: (m: MessageDTO) => void;
  onForward: (m: MessageDTO) => void;
  onEdit: (m: MessageDTO) => void;
  onDelete: (m: MessageDTO) => void;
}) {
  const [menu, setMenu] = useState(false);

  // Service/system messages render as a centered pill (no actions).
  if (message.service) {
    if (!message.text) return null;
    return (
      <div className="my-2 flex justify-center">
        <span className="rounded-full bg-black/30 px-3 py-1 text-center text-xs text-slate-300">
          {message.text}
        </span>
      </div>
    );
  }

  const out = message.out;
  const canEdit = out && !!message.text;

  function copy() {
    if (message.text) void navigator.clipboard.writeText(message.text);
    setMenu(false);
  }

  return (
    <div className={`group relative flex items-center ${out ? "justify-end" : "justify-start"}`}>
      {/* Actions trigger (appears on hover) */}
      <button
        onClick={() => setMenu((v) => !v)}
        aria-label="Message actions"
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 opacity-0 transition hover:bg-white/10 group-hover:opacity-100 ${
          out ? "order-first mr-1" : "order-last ml-1"
        }`}
      >
        ⋯
      </button>

      <div
        className={`relative max-w-[75%] rounded-2xl px-3 py-2 shadow-sm ${
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
          className={`mt-1 text-right text-[10px] ${out ? "text-sky-100/70" : "text-slate-400"}`}
        >
          {timeLabel(message.date)}
        </div>
      </div>

      {menu && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
          <div
            className={`absolute top-8 z-20 w-36 overflow-hidden rounded-lg bg-[#232e3c] py-1 shadow-xl ${
              out ? "right-8" : "left-8"
            }`}
          >
            <MenuItem
              onClick={() => {
                onReply(message);
                setMenu(false);
              }}
            >
              Reply
            </MenuItem>
            {message.text && <MenuItem onClick={copy}>Copy</MenuItem>}
            <MenuItem
              onClick={() => {
                onForward(message);
                setMenu(false);
              }}
            >
              Forward
            </MenuItem>
            {canEdit && (
              <MenuItem
                onClick={() => {
                  onEdit(message);
                  setMenu(false);
                }}
              >
                Edit
              </MenuItem>
            )}
            <MenuItem
              danger
              onClick={() => {
                onDelete(message);
                setMenu(false);
              }}
            >
              Delete
            </MenuItem>
          </div>
        </>
      )}
    </div>
  );
}
