"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Avatar } from "./Avatar";

export function ContactPicker({
  mode,
  title,
  confirmLabel,
  busy,
  onClose,
  onConfirm,
}: {
  mode: "single" | "multi";
  title: string;
  confirmLabel?: string;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (ids: string[]) => void;
}) {
  const { data, isLoading } = useQuery({ queryKey: ["contacts"], queryFn: () => api.contacts() });
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const contacts = useMemo(() => {
    const list = data?.contacts ?? [];
    const term = q.trim().toLowerCase();
    return term
      ? list.filter(
          (c) =>
            c.name.toLowerCase().includes(term) || c.username?.toLowerCase().includes(term),
        )
      : list;
  }, [data, q]);

  function toggle(id: string) {
    if (mode === "single") {
      onConfirm([id]);
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative flex max-h-[80vh] w-full max-w-sm flex-col rounded-2xl bg-[#17212b] shadow-2xl">
        <div className="p-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <input
            className="mt-3 w-full rounded-full bg-slate-900/60 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500/30"
            placeholder="Search contacts"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading && <p className="p-4 text-center text-sm text-slate-500">Loading…</p>}
          {contacts.map((c) => (
            <button
              key={c.id}
              onClick={() => toggle(c.id)}
              className="flex w-full items-center gap-3 px-4 py-2 text-left transition hover:bg-white/5"
            >
              <Avatar chatId={c.id} title={c.name} hasPhoto={c.hasPhoto} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{c.name}</p>
                <p className="truncate text-xs text-slate-400">
                  {c.username ? `@${c.username}` : c.phone ? `+${c.phone}` : ""}
                </p>
              </div>
              {mode === "multi" && (
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full border text-xs ${
                    selected.has(c.id)
                      ? "border-sky-500 bg-sky-500 text-white"
                      : "border-white/30"
                  }`}
                >
                  {selected.has(c.id) ? "✓" : ""}
                </span>
              )}
            </button>
          ))}
          {data && contacts.length === 0 && (
            <p className="p-4 text-center text-sm text-slate-500">No contacts found.</p>
          )}
        </div>

        {mode === "multi" && (
          <div className="flex justify-end gap-2 border-t border-white/10 p-3">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-slate-300 hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm([...selected])}
              disabled={busy || selected.size === 0}
              className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-400 disabled:opacity-50"
            >
              {confirmLabel ?? `Add ${selected.size || ""}`.trim()}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
