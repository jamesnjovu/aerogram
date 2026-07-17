"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export default function FoldersPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["folders"],
    queryFn: () => api.folders(),
  });

  return (
    <div className="mx-auto h-full max-w-xl overflow-y-auto p-6">
      <h1 className="mb-5 text-xl font-semibold">Folders</h1>

      {isLoading && <p className="text-slate-500">Loading…</p>}
      {isError && <p className="text-red-300">Couldn’t load folders.</p>}

      <div className="space-y-2">
        {data?.folders.map((f) => (
          <div
            key={f.id}
            className="flex items-center gap-3 rounded-xl bg-[#17212b] px-4 py-3"
          >
            <span className="text-lg">{f.emoticon ?? "📁"}</span>
            <span>{f.title}</span>
          </div>
        ))}
        {data && data.folders.length === 0 && (
          <p className="text-slate-500">You don’t have any folders yet.</p>
        )}
      </div>

      <p className="mt-4 text-xs text-slate-500">
        Creating and editing folders is coming soon.
      </p>
    </div>
  );
}
