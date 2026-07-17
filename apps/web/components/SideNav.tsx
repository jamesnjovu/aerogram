"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/store/useAuth";
import { SelfAvatar } from "./SelfAvatar";
import { NewChatModal } from "./NewChatModal";
import { ContactPicker } from "./ContactPicker";

function NavItem({
  icon,
  label,
  onClick,
}: {
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-4 px-5 py-3 text-left text-[15px] transition hover:bg-white/5"
    >
      <span className="w-5 text-center text-lg">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

export function SideNav() {
  const router = useRouter();
  const me = useAuth((s) => s.me);
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState<null | "group" | "channel">(null);
  const [newMessage, setNewMessage] = useState(false);

  function go(path: string) {
    setOpen(false);
    router.push(path);
  }

  const displayName = me ? `${me.firstName}${me.lastName ? ` ${me.lastName}` : ""}` : "Me";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Menu"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl text-slate-200 hover:bg-white/10"
      >
        ☰
      </button>

      {open && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <nav className="absolute left-0 top-0 flex h-full w-72 flex-col bg-[#17212b] shadow-2xl">
            <button
              onClick={() => go("/profile")}
              className="flex items-center gap-3 border-b border-white/10 px-5 py-5 text-left hover:bg-white/5"
            >
              <SelfAvatar id={me?.id ?? "me"} name={displayName} size={56} />
              <div className="min-w-0">
                <p className="truncate font-semibold">{displayName}</p>
                <p className="truncate text-xs text-slate-400">
                  {me?.username ? `@${me.username}` : me?.phone ?? ""}
                </p>
              </div>
            </button>

            <div className="flex-1 overflow-y-auto py-2">
              <NavItem icon="👤" label="My Profile" onClick={() => go("/profile")} />
              <NavItem
                icon="✏️"
                label="New Message"
                onClick={() => {
                  setOpen(false);
                  setNewMessage(true);
                }}
              />
              <NavItem
                icon="👥"
                label="New Group"
                onClick={() => {
                  setOpen(false);
                  setModal("group");
                }}
              />
              <NavItem
                icon="📢"
                label="New Channel"
                onClick={() => {
                  setOpen(false);
                  setModal("channel");
                }}
              />
              <NavItem icon="📁" label="Folders" onClick={() => go("/folders")} />
              <NavItem
                icon="🔖"
                label="Saved Messages"
                onClick={() => (me ? go(`/chat/${encodeURIComponent(me.id)}`) : setOpen(false))}
              />
              <NavItem icon="📞" label="Calls" onClick={() => go("/calls")} />
              <NavItem icon="⚙️" label="Settings" onClick={() => go("/settings")} />
            </div>

            <div className="border-t border-white/10 px-5 py-3 text-xs text-slate-500">
              Aerogram · web client
            </div>
          </nav>
        </div>
      )}

      {modal && <NewChatModal kind={modal} onClose={() => setModal(null)} />}

      {newMessage && (
        <ContactPicker
          mode="single"
          title="New Message"
          onClose={() => setNewMessage(false)}
          onConfirm={(ids) => {
            setNewMessage(false);
            if (ids[0]) router.push(`/chat/${encodeURIComponent(ids[0])}`);
          }}
        />
      )}
    </>
  );
}
