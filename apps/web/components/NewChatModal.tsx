"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { ContactPicker } from "./ContactPicker";

const inputClass =
  "w-full rounded-lg bg-slate-900/60 border border-white/10 px-3 py-2.5 text-[15px] " +
  "outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 transition";

export function NewChatModal({
  kind,
  onClose,
}: {
  kind: "group" | "channel";
  onClose: () => void;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [about, setAbout] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [pickMembers, setPickMembers] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const label = kind === "group" ? "Group" : "Channel";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res =
        kind === "group"
          ? await api.createGroup(t, about.trim() || undefined)
          : await api.createChannel(t, about.trim() || undefined);
      if (members.length) {
        // Best-effort: creation succeeded even if some invites are restricted.
        await api.addMembers(res.id, members).catch(() => {});
      }
      qc.invalidateQueries({ queryKey: ["dialogs"] });
      onClose();
      router.push(`/chat/${encodeURIComponent(res.id)}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Couldn't create ${label.toLowerCase()}.`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <form
        onSubmit={submit}
        className="relative w-full max-w-sm rounded-2xl bg-[#17212b] p-6 shadow-2xl"
      >
        <h2 className="mb-4 text-lg font-semibold">New {label}</h2>
        <div className="space-y-3">
          <input
            className={inputClass}
            placeholder={`${label} name`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            required
          />
          <textarea
            className={`${inputClass} resize-none`}
            placeholder="Description (optional)"
            rows={3}
            value={about}
            onChange={(e) => setAbout(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setPickMembers(true)}
            className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-slate-900/40 px-3 py-2.5 text-sm text-slate-300 hover:bg-white/5"
          >
            <span>Add members</span>
            <span className="text-slate-500">{members.length ? `${members.length} selected` : "›"}</span>
          </button>
        </div>
        {error && (
          <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-slate-300 hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !title.trim()}
            className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-400 disabled:opacity-50"
          >
            {loading ? "Creating…" : "Create"}
          </button>
        </div>
      </form>

      {pickMembers && (
        <ContactPicker
          mode="multi"
          title="Add members"
          confirmLabel="Done"
          onClose={() => setPickMembers(false)}
          onConfirm={(ids) => {
            setMembers(ids);
            setPickMembers(false);
          }}
        />
      )}
    </div>
  );
}
