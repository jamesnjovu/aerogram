"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AttachmentKind, MessageDTO } from "@aerogram/shared";
import { api } from "@/lib/api";
import { PollModal } from "./PollModal";

const ATTACH_ITEMS: {
  kind: AttachmentKind | "location" | "poll";
  label: string;
  icon: string;
  accept?: string;
}[] = [
  { kind: "photo", label: "Photo", icon: "🖼️", accept: "image/*" },
  { kind: "video", label: "Video", icon: "🎬", accept: "video/*" },
  { kind: "file", label: "File", icon: "📎", accept: "*/*" },
  { kind: "music", label: "Music", icon: "🎵", accept: "audio/*" },
  { kind: "location", label: "Location", icon: "📍" },
  { kind: "poll", label: "Poll", icon: "📊" },
];

function clock(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export function Composer({
  chatId,
  onSent,
  replyTo,
  editing,
  isBot,
  onClearReply,
  onClearEdit,
}: {
  chatId: string;
  onSent?: () => void;
  replyTo?: MessageDTO | null;
  editing?: MessageDTO | null;
  isBot?: boolean;
  onClearReply?: () => void;
  onClearEdit?: () => void;
}) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [attachMenu, setAttachMenu] = useState(false);
  const [botMenu, setBotMenu] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const kindRef = useRef<AttachmentKind>("file");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelRef = useRef(false);

  useEffect(() => {
    if (editing) {
      setText(editing.text);
      taRef.current?.focus();
    }
  }, [editing]);

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
    },
    [],
  );

  const { data: botData } = useQuery({
    queryKey: ["botCommands", chatId],
    queryFn: () => api.botCommands(chatId),
    enabled: !!isBot,
  });
  const commands = botData?.commands ?? [];

  function invalidateAndClear() {
    setText("");
    qc.invalidateQueries({ queryKey: ["messages", chatId] });
    qc.invalidateQueries({ queryKey: ["dialogs"] });
    onSent?.();
  }

  const sendMut = useMutation({
    mutationFn: (t: string) => api.send(chatId, t, replyTo?.id ?? undefined),
    onSuccess: () => {
      onClearReply?.();
      invalidateAndClear();
    },
  });
  const editMut = useMutation({
    mutationFn: (t: string) => api.editMessage(chatId, editing!.id, t),
    onSuccess: () => {
      onClearEdit?.();
      invalidateAndClear();
    },
  });
  const attachMut = useMutation({
    mutationFn: ({ kind, file }: { kind: AttachmentKind; file: File }) =>
      api.sendAttachment(chatId, kind, file, text.trim() || undefined),
    onSuccess: invalidateAndClear,
  });
  const locationMut = useMutation({
    mutationFn: ({ lat, long }: { lat: number; long: number }) => api.sendLocation(chatId, lat, long),
    onSuccess: invalidateAndClear,
  });
  const pollMut = useMutation({
    mutationFn: (p: {
      question: string;
      options: string[];
      anonymous: boolean;
      quiz: boolean;
      correctOption?: number;
    }) =>
      api.sendPoll(chatId, p.question, p.options, {
        anonymous: p.anonymous,
        quiz: p.quiz,
        correctOption: p.correctOption,
      }),
    onSuccess: () => {
      setPollOpen(false);
      invalidateAndClear();
    },
  });

  const busy =
    sendMut.isPending ||
    editMut.isPending ||
    attachMut.isPending ||
    locationMut.isPending ||
    pollMut.isPending;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || busy) return;
    if (editing) editMut.mutate(t);
    else sendMut.mutate(t);
  }

  function pickFile(kind: AttachmentKind, accept: string) {
    kindRef.current = kind;
    if (fileRef.current) {
      fileRef.current.accept = accept;
      fileRef.current.click();
    }
    setAttachMenu(false);
  }
  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) attachMut.mutate({ kind: kindRef.current, file });
    if (fileRef.current) fileRef.current.value = "";
  }
  function shareLocation() {
    setAttachMenu(false);
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => locationMut.mutate({ lat: pos.coords.latitude, long: pos.coords.longitude }),
      () => {},
    );
  }
  function onAttachItem(item: (typeof ATTACH_ITEMS)[number]) {
    if (item.kind === "location") shareLocation();
    else if (item.kind === "poll") {
      setAttachMenu(false);
      setPollOpen(true);
    } else pickFile(item.kind, item.accept ?? "*/*");
  }
  function runCommand(command: string) {
    setText(`/${command} `);
    setBotMenu(false);
    taRef.current?.focus();
  }

  /* ------------------------------ voice recording ------------------------------ */
  async function startRecording() {
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      cancelRef.current = false;
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      rec.onstop = () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        setRecording(false);
        setRecSecs(0);
        if (cancelRef.current) return;
        const type = rec.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        if (blob.size < 1024) return;
        const ext = type.includes("ogg") ? "ogg" : "webm";
        attachMut.mutate({ kind: "voice", file: new File([blob], `voice.${ext}`, { type }) });
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
      setRecSecs(0);
      timerRef.current = setInterval(() => setRecSecs((s) => s + 1), 1000);
    } catch {
      /* mic permission denied / unavailable */
    }
  }
  function stopRecording(send: boolean) {
    cancelRef.current = !send;
    recorderRef.current?.stop();
  }

  const preview = editing ?? replyTo;
  const hasText = text.trim().length > 0;

  return (
    <form onSubmit={submit} className="relative border-t border-white/10 bg-[#17212b]">
      {preview && !recording && (
        <div className="flex items-center gap-2 px-4 pt-2">
          <div className="min-w-0 flex-1 border-l-2 border-sky-500 pl-2 text-xs">
            <p className="text-sky-300">{editing ? "Editing" : "Reply"}</p>
            <p className="truncate text-slate-400">{preview.text || "Media"}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (editing) {
                onClearEdit?.();
                setText("");
              } else onClearReply?.();
            }}
            className="text-slate-400 hover:text-white"
            aria-label="Cancel"
          >
            ✕
          </button>
        </div>
      )}

      {recording ? (
        <div className="flex items-center gap-3 p-3">
          <span className="flex h-3 w-3 animate-pulse rounded-full bg-red-500" />
          <span className="flex-1 text-sm text-slate-300">Recording… {clock(recSecs)}</span>
          <button
            type="button"
            onClick={() => stopRecording(false)}
            className="rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => stopRecording(true)}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-sky-500 text-white hover:bg-sky-400"
            aria-label="Send voice"
          >
            ➤
          </button>
        </div>
      ) : (
        <div className="flex items-end gap-1 p-3">
          {isBot && commands.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setBotMenu((v) => !v)}
                className="flex h-11 w-9 items-center justify-center rounded-full text-lg text-slate-300 hover:bg-white/10"
                title="Commands"
              >
                /
              </button>
              {botMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setBotMenu(false)} />
                  <div className="absolute bottom-12 left-0 z-20 max-h-64 w-64 overflow-y-auto rounded-lg bg-[#232e3c] py-1 shadow-xl">
                    {commands.map((c) => (
                      <button
                        key={c.command}
                        type="button"
                        onClick={() => runCommand(c.command)}
                        className="block w-full px-3 py-1.5 text-left hover:bg-white/10"
                      >
                        <span className="text-sm text-sky-300">/{c.command}</span>
                        {c.description && (
                          <span className="block truncate text-xs text-slate-400">
                            {c.description}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="relative">
            <button
              type="button"
              onClick={() => setAttachMenu((v) => !v)}
              className="flex h-11 w-9 items-center justify-center rounded-full text-xl text-slate-300 hover:bg-white/10"
              title="Attach"
            >
              📎
            </button>
            {attachMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setAttachMenu(false)} />
                <div className="absolute bottom-12 left-0 z-20 w-44 overflow-hidden rounded-lg bg-[#232e3c] py-1 shadow-xl">
                  {ATTACH_ITEMS.map((item) => (
                    <button
                      key={item.kind}
                      type="button"
                      onClick={() => onAttachItem(item)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-white/10"
                    >
                      <span>{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            <input ref={fileRef} type="file" className="hidden" onChange={onFile} />
          </div>

          <textarea
            ref={taRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(e);
              }
            }}
            rows={1}
            placeholder={busy ? "Sending…" : "Message"}
            disabled={busy}
            className="max-h-40 min-h-[44px] flex-1 resize-none rounded-2xl bg-slate-900/60 px-4 py-3 text-[15px] outline-none focus:ring-2 focus:ring-sky-500/30 disabled:opacity-60"
          />

          {hasText || editing ? (
            <button
              type="submit"
              disabled={busy || !hasText}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white transition hover:bg-sky-400 disabled:opacity-40"
              aria-label={editing ? "Save edit" : "Send"}
            >
              {editing ? "✓" : "➤"}
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              disabled={busy}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl text-slate-300 hover:bg-white/10 disabled:opacity-40"
              aria-label="Record voice"
              title="Record voice message"
            >
              🎤
            </button>
          )}
        </div>
      )}

      {pollOpen && (
        <PollModal
          busy={pollMut.isPending}
          onClose={() => setPollOpen(false)}
          onSubmit={(question, options, opts) => pollMut.mutate({ question, options, ...opts })}
        />
      )}
    </form>
  );
}
