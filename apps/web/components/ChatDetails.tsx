"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MessageDTO, SharedMediaType } from "@aerogram/shared";
import { api, mediaUrl } from "@/lib/api";
import { Avatar } from "./Avatar";
import { VideoPlayer } from "./VideoPlayer";
import { MediaLightbox } from "./MediaLightbox";
import { chatTypeLabel, formatDuration } from "@/lib/format";
import { ratio } from "@/lib/media";

const TABS: { key: SharedMediaType; label: string }[] = [
  { key: "media", label: "Media" },
  { key: "file", label: "Files" },
  { key: "link", label: "Links" },
  { key: "music", label: "Music" },
  { key: "voice", label: "Voice" },
  { key: "gif", label: "GIFs" },
];

function ActionRow({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-3 text-left text-[15px] transition hover:bg-white/5 ${
        danger ? "text-red-300" : ""
      }`}
    >
      <span className="w-5 text-center">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

export function ChatDetails({ chatId }: { chatId: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [tab, setTab] = useState<SharedMediaType>("media");
  const [notice, setNotice] = useState<string | null>(null);

  const { data: info, isLoading } = useQuery({
    queryKey: ["chatInfo", chatId],
    queryFn: () => api.chatInfo(chatId),
  });

  const muteMut = useMutation({
    mutationFn: (m: boolean) => api.muteChat(chatId, m),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chatInfo", chatId] }),
  });

  const leaveMut = useMutation({
    mutationFn: () => api.leaveChat(chatId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dialogs"] });
      router.push("/");
    },
  });

  function flash(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice((n) => (n === msg ? null : n)), 2000);
  }
  function copyLink() {
    if (info?.link) {
      void navigator.clipboard.writeText(info.link);
      flash("Link copied");
    }
  }
  function share() {
    if (!info?.link) return;
    if (typeof navigator.share === "function") {
      void navigator.share({ title: info.title, url: info.link }).catch(() => {});
    } else {
      copyLink();
    }
  }
  function leave() {
    if (window.confirm(`Leave ${info?.title ?? "this chat"}?`)) leaveMut.mutate();
  }

  return (
    <div className="mx-auto h-full max-w-2xl overflow-y-auto">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-white/10 bg-[#17212b] px-4 py-2.5">
        <Link
          href={`/chat/${encodeURIComponent(chatId)}`}
          className="rounded-full px-2 py-1 text-lg hover:bg-white/10"
          aria-label="Back to chat"
        >
          ←
        </Link>
        <span className="font-medium">Chat info</span>
      </div>

      {isLoading && <p className="p-6 text-slate-500">Loading…</p>}

      {info && (
        <>
          <div className="flex flex-col items-center gap-2 p-6 text-center">
            <Avatar chatId={chatId} title={info.title} hasPhoto size={96} />
            <h1 className="text-xl font-semibold">{info.title}</h1>
            <p className="text-sm text-slate-400">
              {chatTypeLabel(info.type) || "Direct message"}
              {info.memberCount ? ` · ${info.memberCount.toLocaleString()} members` : ""}
            </p>
            {info.username && <p className="text-sm text-sky-300">@{info.username}</p>}
          </div>

          {info.about && (
            <p className="mx-6 mb-4 whitespace-pre-wrap rounded-xl bg-[#17212b] p-4 text-sm">
              {info.about}
            </p>
          )}

          <div className="mx-6 mb-4 overflow-hidden rounded-xl bg-[#17212b]">
            <ActionRow
              icon={info.muted ? "🔔" : "🔕"}
              label={info.muted ? "Unmute notifications" : "Mute notifications"}
              onClick={() => muteMut.mutate(!info.muted)}
            />
            {info.link && <ActionRow icon="🔗" label="Copy link" onClick={copyLink} />}
            {info.link && <ActionRow icon="↗️" label="Share" onClick={share} />}
            {info.canLeave && <ActionRow icon="🚪" label="Leave" onClick={leave} danger />}
          </div>

          <div className="mx-6 pb-8">
            <div className="flex gap-1 overflow-x-auto border-b border-white/10">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`shrink-0 px-3 py-2 text-sm transition ${
                    tab === t.key
                      ? "border-b-2 border-sky-500 text-sky-300"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <SharedMedia chatId={chatId} type={tab} />
          </div>
        </>
      )}

      {notice && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-xs text-white">
          {notice}
        </div>
      )}
    </div>
  );
}

const TILE_BOX = "relative aspect-square overflow-hidden rounded bg-black/30";
const TILE_ICON =
  "absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full " +
  "bg-black/60 text-xs text-white backdrop-blur transition hover:bg-black/85";

/** Grid tile that swaps its poster for an in-app player, keeping the tile's shape. */
function VideoTile({ chatId, message }: { chatId: string; message: MessageDTO }) {
  const [playing, setPlaying] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [aspect, setAspect] = useState(ratio(message.media?.width, message.media?.height));
  const src = mediaUrl(chatId, message.id);
  const poster = mediaUrl(chatId, message.id, { thumb: true });

  const lightbox = expanded && (
    <MediaLightbox
      item={{ kind: "video", src, poster, aspect, title: message.media?.fileName }}
      onClose={() => setExpanded(false)}
    />
  );

  if (playing) {
    return (
      <>
        <div className={TILE_BOX}>
          <VideoPlayer src={src} poster={poster} onAspect={setAspect} />
          <button
            onClick={() => {
              setPlaying(false); // avoid two copies playing at once
              setExpanded(true);
            }}
            className={TILE_ICON}
            title="Fullscreen"
            aria-label="Fullscreen"
          >
            ⛶
          </button>
        </div>
        {lightbox}
      </>
    );
  }

  return (
    <>
      <div className={`group ${TILE_BOX}`}>
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="absolute inset-0 h-full w-full"
          aria-label="Play video"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={poster}
            alt=""
            loading="lazy"
            onLoad={(e) => {
              const r = ratio(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight);
              if (r) setAspect((a) => a ?? r);
            }}
            className="h-full w-full object-cover"
          />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-lg text-white transition group-hover:bg-black/75">
              ▶
            </span>
          </span>
        </button>
        {message.media?.duration ? (
          <span className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/60 px-1 text-[10px] text-white">
            {formatDuration(message.media.duration)}
          </span>
        ) : null}
        <button
          onClick={() => setExpanded(true)}
          className={`${TILE_ICON} opacity-0 group-hover:opacity-100 focus-visible:opacity-100`}
          title="Fullscreen"
          aria-label="Fullscreen"
        >
          ⛶
        </button>
      </div>
      {lightbox}
    </>
  );
}

/** Photo tile — opens in the in-app viewer instead of a raw browser tab. */
function PhotoTile({ chatId, message }: { chatId: string; message: MessageDTO }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setExpanded(true)} className={TILE_BOX}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={mediaUrl(chatId, message.id, { thumb: true })}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
        />
      </button>
      {expanded && (
        <MediaLightbox
          item={{
            kind: "photo",
            src: mediaUrl(chatId, message.id),
            title: message.media?.fileName,
          }}
          onClose={() => setExpanded(false)}
        />
      )}
    </>
  );
}

function SharedMedia({ chatId, type }: { chatId: string; type: SharedMediaType }) {
  const q = useInfiniteQuery({
    queryKey: ["sharedMedia", chatId, type],
    queryFn: ({ pageParam }) => api.sharedMedia(chatId, type, pageParam as number),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffsetId ?? undefined,
  });

  const items = q.data?.pages.flatMap((p) => p.messages) ?? [];

  if (q.isLoading) return <p className="py-8 text-center text-sm text-slate-500">Loading…</p>;
  if (items.length === 0)
    return <p className="py-8 text-center text-sm text-slate-500">Nothing here yet.</p>;

  const isGrid = type === "media" || type === "gif";

  return (
    <div className="py-3">
      {isGrid ? (
        <div className="grid grid-cols-3 gap-1">
          {items.map((m) =>
            m.media?.type === "video" ? (
              <VideoTile key={m.id} chatId={chatId} message={m} />
            ) : (
              <PhotoTile key={m.id} chatId={chatId} message={m} />
            ),
          )}
        </div>
      ) : (
        <div className="space-y-1">
          {items.map((m) =>
            type === "link" ? (
              <div
                key={m.id}
                className="break-words rounded-lg bg-[#17212b] px-3 py-2 text-sm text-sky-300"
              >
                {m.text || "(link)"}
              </div>
            ) : (
              <a
                key={m.id}
                href={mediaUrl(chatId, m.id, { download: true })}
                className="flex items-center gap-3 rounded-lg bg-[#17212b] px-3 py-2 transition hover:bg-white/5"
              >
                <span className="text-lg">
                  {type === "music" ? "🎵" : type === "voice" ? "🎤" : "📎"}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm">
                    {m.media?.fileName ?? m.text ?? type}
                  </p>
                  <p className="truncate text-xs text-slate-400">{m.media?.mimeType ?? ""}</p>
                </div>
              </a>
            ),
          )}
        </div>
      )}

      {q.hasNextPage && (
        <button
          onClick={() => q.fetchNextPage()}
          disabled={q.isFetchingNextPage}
          className="mt-3 w-full rounded-lg bg-white/5 py-2 text-sm text-slate-300 hover:bg-white/10"
        >
          {q.isFetchingNextPage ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}
