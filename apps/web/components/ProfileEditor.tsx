"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Birthday, ProfileDTO } from "@aerogram/shared";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/store/useAuth";
import { SelfAvatar } from "./SelfAvatar";

const inputClass =
  "w-full rounded-lg bg-slate-900/60 border border-white/10 px-3 py-2.5 text-[15px] " +
  "outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 transition";
const sectionClass = "rounded-xl bg-[#17212b] p-4";
const saveBtn =
  "rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-400 disabled:opacity-50";

function toDateInput(b?: Birthday): string {
  if (!b || !b.year) return "";
  return `${b.year}-${String(b.month).padStart(2, "0")}-${String(b.day).padStart(2, "0")}`;
}

export function ProfileEditor() {
  const router = useRouter();
  const qc = useQueryClient();
  const setMe = useAuth((s) => s.setMe);

  const { data, isLoading } = useQuery({ queryKey: ["profile"], queryFn: () => api.getProfile() });

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [bio, setBio] = useState("");
  const [username, setUsername] = useState("");
  const [birthday, setBirthday] = useState("");
  const [avatarVersion, setAvatarVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!data) return;
    setFirstName(data.firstName ?? "");
    setLastName(data.lastName ?? "");
    setBio(data.bio ?? "");
    setUsername(data.username ?? "");
    setBirthday(toDateInput(data.birthday));
  }, [data]);

  function apply(p: ProfileDTO) {
    qc.setQueryData(["profile"], p);
    setMe({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      username: p.username,
      phone: p.phone,
    });
  }

  async function run(fn: () => Promise<ProfileDTO>, msg: string, bustAvatar = false) {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      apply(await fn());
      if (bustAvatar) setAvatarVersion(Date.now());
      setStatus(msg);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const saveProfile = () =>
    run(
      () =>
        api.updateProfile({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          bio: bio.trim(),
        }),
      "Profile saved",
    );

  const saveUsername = () => run(() => api.updateUsername(username.trim()), "Username updated");

  const saveBirthday = () => {
    if (!birthday) return;
    const [y, m, d] = birthday.split("-").map(Number);
    return run(() => api.updateBirthday({ day: d, month: m, year: y }), "Birthday updated");
  };

  const clearBirthday = () => {
    setBirthday("");
    return run(() => api.clearBirthday(), "Birthday cleared");
  };

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void run(() => api.uploadPhoto(file), "Photo updated", true);
    if (fileRef.current) fileRef.current.value = "";
  }

  const removePhoto = () => run(() => api.deletePhoto(), "Photo removed", true);

  function copyPhone() {
    if (!data?.phone) return;
    void navigator.clipboard.writeText(data.phone);
    setStatus("Phone number copied");
    setError(null);
  }

  async function logout() {
    try {
      await api.logout();
    } finally {
      setMe(null);
      qc.clear();
      router.replace("/login");
    }
  }

  const displayName = `${firstName}${lastName ? ` ${lastName}` : ""}` || "Me";

  return (
    <div className="mx-auto h-full max-w-xl overflow-y-auto p-6">
      <h1 className="mb-5 text-xl font-semibold">My Profile</h1>

      {isLoading && <p className="text-slate-500">Loading…</p>}

      {data && (
        <div className="space-y-4">
          {/* Avatar */}
          <div className={`${sectionClass} flex items-center gap-4`}>
            <SelfAvatar
              id={data.id}
              name={displayName}
              size={72}
              version={avatarVersion}
              tryPhoto={data.hasPhoto || avatarVersion > 0}
            />
            <div className="flex flex-wrap gap-2">
              <button onClick={() => fileRef.current?.click()} className={saveBtn} disabled={busy}>
                Change photo
              </button>
              {data.hasPhoto && (
                <button
                  onClick={removePhoto}
                  disabled={busy}
                  className="rounded-lg px-4 py-2 text-sm text-red-300 hover:bg-red-500/10"
                >
                  Remove
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onPickFile}
              />
            </div>
          </div>

          {/* Name + bio */}
          <div className={`${sectionClass} space-y-3`}>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs text-slate-400">First name</span>
                <input
                  className={inputClass}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-slate-400">Last name</span>
                <input
                  className={inputClass}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs text-slate-400">Bio</span>
              <textarea
                className={`${inputClass} resize-none`}
                rows={2}
                maxLength={140}
                placeholder="A few words about you"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            </label>
            <div className="flex justify-end">
              <button onClick={saveProfile} disabled={busy} className={saveBtn}>
                Save
              </button>
            </div>
          </div>

          {/* Username */}
          <div className={`${sectionClass} space-y-3`}>
            <label className="block">
              <span className="mb-1 block text-xs text-slate-400">Username</span>
              <div className="flex gap-2">
                <div className="flex flex-1 items-center rounded-lg border border-white/10 bg-slate-900/60 px-3">
                  <span className="text-slate-500">@</span>
                  <input
                    className="w-full bg-transparent py-2.5 pl-1 outline-none"
                    value={username}
                    placeholder="username"
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
                <button onClick={saveUsername} disabled={busy} className={saveBtn}>
                  Save
                </button>
              </div>
            </label>
          </div>

          {/* Birthday */}
          <div className={`${sectionClass} space-y-3`}>
            <label className="block">
              <span className="mb-1 block text-xs text-slate-400">Date of birth</span>
              <div className="flex gap-2">
                <input
                  type="date"
                  className={`${inputClass} flex-1 [color-scheme:dark]`}
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                />
                <button onClick={saveBirthday} disabled={busy || !birthday} className={saveBtn}>
                  Save
                </button>
                {data.birthday && (
                  <button
                    onClick={clearBirthday}
                    disabled={busy}
                    className="rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/10"
                  >
                    Clear
                  </button>
                )}
              </div>
            </label>
          </div>

          {/* Phone */}
          <div className={`${sectionClass} flex items-center justify-between`}>
            <div>
              <p className="text-xs text-slate-400">Mobile number</p>
              <p className="text-[15px]">{data.phone ? `+${data.phone}` : "—"}</p>
            </div>
            <button
              onClick={copyPhone}
              disabled={!data.phone}
              className="rounded-lg px-4 py-2 text-sm text-sky-300 hover:bg-sky-500/10 disabled:opacity-40"
            >
              Copy
            </button>
          </div>

          {/* Status / errors */}
          {status && (
            <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
              {status}
            </p>
          )}
          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
          )}

          {/* Logout */}
          <div className={sectionClass}>
            <button
              onClick={logout}
              className="w-full rounded-lg bg-red-500/15 px-4 py-2.5 text-sm font-medium text-red-300 hover:bg-red-500/25"
            >
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
