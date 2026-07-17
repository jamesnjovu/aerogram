"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/store/useAuth";
import { useRealtime } from "@/lib/useRealtime";
import { ChatList } from "@/components/ChatList";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const setMe = useAuth((s) => s.setMe);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .me()
      .then(({ me }) => {
        if (active) {
          setMe(me);
          setReady(true);
        }
      })
      .catch(() => router.replace("/login"));
    return () => {
      active = false;
    };
  }, [router, setMe]);

  useRealtime(ready);

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500">Connecting…</div>
    );
  }

  return (
    <div className="flex h-full">
      <aside className="w-[340px] shrink-0 border-r border-white/10 bg-[#17212b]">
        <ChatList />
      </aside>
      <main className="min-w-0 flex-1 bg-[#0e1621]">{children}</main>
    </div>
  );
}
