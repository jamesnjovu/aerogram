"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { MessageButton, MessageDTO } from "@aerogram/shared";
import { api } from "@/lib/api";
import { timeLabel, formatDuration } from "@/lib/format";
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
  onCall,
  onNotice,
}: {
  message: MessageDTO;
  chatId: string;
  onReply: (m: MessageDTO) => void;
  onForward: (m: MessageDTO) => void;
  onEdit: (m: MessageDTO) => void;
  onDelete: (m: MessageDTO) => void;
  onCall: (m: MessageDTO) => void;
  onNotice: (msg: string) => void;
}) {
  const [menu, setMenu] = useState(false);
  const qc = useQueryClient();

  async function onButton(b: MessageButton) {
    if (b.kind === "url" && b.url) {
      window.open(b.url, "_blank", "noopener");
      return;
    }
    if (b.kind === "text") {
      await api.send(chatId, b.text).catch(() => {});
      qc.invalidateQueries({ queryKey: ["messages", chatId] });
      qc.invalidateQueries({ queryKey: ["dialogs"] });
      return;
    }
    if (b.kind === "callback" && b.data) {
      try {
        const res = await api.botCallback(chatId, message.id, b.data);
        if (res.url) window.open(res.url, "_blank", "noopener");
        if (res.text) onNotice(res.text);
      } catch {
        onNotice("Action failed");
      }
      return;
    }
    onNotice("This button isn’t supported in the web client.");
  }

  // Call service messages render as a call row with a call-back button.
  if (message.call) {
    const c = message.call;
    const out = message.out;
    const missedIncoming = c.missed && !out;
    const label = c.missed
      ? out
        ? "Cancelled call"
        : "Missed call"
      : out
        ? "Outgoing call"
        : "Incoming call";
    return (
      <div className={`flex ${out ? "justify-end" : "justify-start"}`}>
        <div
          className={`flex max-w-[75%] items-center gap-3 rounded-2xl px-3 py-2 ${
            out ? "bg-sky-600 text-white" : "bg-slate-700/70 text-slate-100"
          }`}
        >
          <span className={`text-lg ${missedIncoming ? "text-red-300" : ""}`}>
            {c.video ? "📹" : "📞"}
          </span>
          <div className="min-w-0">
            <p className={`text-sm ${missedIncoming ? "text-red-300" : ""}`}>{label}</p>
            <p className="text-[11px] opacity-70">
              {timeLabel(message.date)}
              {c.duration ? ` · ${formatDuration(c.duration)}` : ""}
            </p>
          </div>
          <button
            onClick={() => onCall(message)}
            title={c.video ? "Video call back" : "Call back"}
            aria-label="Call back"
            className="ml-1 flex h-8 w-8 items-center justify-center rounded-full text-base hover:bg-white/15"
          >
            ↺
          </button>
        </div>
      </div>
    );
  }

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

      <div className={`flex max-w-[75%] flex-col ${out ? "items-end" : "items-start"}`}>
        <div
          className={`relative w-fit max-w-full rounded-2xl px-3 py-2 shadow-sm ${
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

        {message.buttons && (
          <div className="mt-1 w-full space-y-1">
            {message.buttons.map((row, ri) => (
              <div key={ri} className="flex gap-1">
                {row.map((b, bi) => (
                  <button
                    key={bi}
                    onClick={() => onButton(b)}
                    className="flex-1 rounded-lg bg-slate-600/60 px-2 py-1.5 text-center text-sm text-slate-100 transition hover:bg-slate-600"
                  >
                    {b.text}
                    {b.kind === "url" ? " ↗" : ""}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
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
