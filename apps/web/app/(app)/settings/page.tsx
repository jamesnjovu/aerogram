"use client";

import Link from "next/link";
import { useAuth } from "@/store/useAuth";

export default function SettingsPage() {
  const me = useAuth((s) => s.me);
  const name = me ? `${me.firstName}${me.lastName ? ` ${me.lastName}` : ""}` : "";

  return (
    <div className="mx-auto h-full max-w-xl overflow-y-auto p-6">
      <h1 className="mb-5 text-xl font-semibold">Settings</h1>

      <div className="space-y-2">
        <Link
          href="/profile"
          className="flex items-center justify-between rounded-xl bg-[#17212b] px-4 py-3 transition hover:bg-white/5"
        >
          <span>Edit profile</span>
          <span className="text-slate-500">›</span>
        </Link>

        <div className="rounded-xl bg-[#17212b] px-4 py-3">
          <p className="text-xs text-slate-400">Account</p>
          <p className="text-[15px]">{name}</p>
          <p className="text-xs text-slate-400">
            {me?.username ? `@${me.username}` : me?.phone ? `+${me.phone}` : ""}
          </p>
        </div>

        <div className="rounded-xl bg-[#17212b] px-4 py-3 text-sm text-slate-400">
          <p className="mb-1 font-medium text-slate-200">About Aerogram</p>
          A personal web-based Telegram client — chats, media, and live updates over Telegram’s
          MTProto API.
        </div>
      </div>
    </div>
  );
}
