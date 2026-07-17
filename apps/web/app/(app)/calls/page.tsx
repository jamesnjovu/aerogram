"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { dayLabel, formatDuration } from "@/lib/format";

export default function CallsPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["calls"],
    queryFn: () => api.calls(),
  });

  return (
    <div className="mx-auto h-full max-w-xl overflow-y-auto p-6">
      <h1 className="mb-5 text-xl font-semibold">Calls</h1>

      {isLoading && <p className="text-slate-500">Loading…</p>}
      {isError && <p className="text-red-300">Couldn’t load call history.</p>}

      <div className="space-y-2">
        {data?.calls.map((c) => (
          <div
            key={c.id}
            className="flex items-center gap-3 rounded-xl bg-[#17212b] px-4 py-3"
          >
            <span className="text-lg">{c.video ? "📹" : "📞"}</span>
            <div className="flex-1">
              <p className={`text-sm ${c.missed ? "text-red-300" : ""}`}>
                {c.missed ? "Missed" : c.out ? "Outgoing" : "Incoming"}{" "}
                {c.video ? "video call" : "call"}
              </p>
              <p className="text-xs text-slate-400">
                {dayLabel(c.date)}
                {c.duration ? ` · ${formatDuration(c.duration)}` : ""}
              </p>
            </div>
          </div>
        ))}
        {data && data.calls.length === 0 && (
          <p className="text-slate-500">No recent calls.</p>
        )}
      </div>
    </div>
  );
}
