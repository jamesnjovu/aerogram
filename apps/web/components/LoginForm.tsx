"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MeDTO } from "@aerogram/shared";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/store/useAuth";

type Step = "phone" | "code" | "password";

const inputClass =
  "w-full rounded-lg bg-slate-900/60 border border-white/10 px-4 py-3 text-[15px] " +
  "outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 transition";

function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  return "Something went wrong. Please try again.";
}

export function LoginForm() {
  const router = useRouter();
  const setMe = useAuth((s) => s.setMe);

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [tempToken, setTempToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function finish(me?: MeDTO) {
    if (me) setMe(me);
    router.replace("/");
  }

  async function onPhone(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { tempToken } = await api.sendCode(phone.trim());
      setTempToken(tempToken);
      setStep("code");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function onCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.signIn(tempToken, code.trim());
      if (res.needPassword) setStep("password");
      else finish(res.me);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function onPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.password(tempToken, password);
      finish(res.me);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm rounded-2xl bg-[#17212b] p-8 shadow-2xl shadow-black/40">
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-sky-500 text-3xl">
          ✈️
        </div>
        <h1 className="text-xl font-semibold">Aerogram</h1>
        <p className="mt-1 text-sm text-slate-400">
          {step === "phone" && "Enter your phone number to sign in"}
          {step === "code" && "Enter the code Telegram sent you"}
          {step === "password" && "Enter your two-step verification password"}
        </p>
      </div>

      {step === "phone" && (
        <form onSubmit={onPhone} className="space-y-4">
          <input
            className={inputClass}
            type="tel"
            inputMode="tel"
            placeholder="+1 555 123 4567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoFocus
            required
          />
          <SubmitButton loading={loading}>Send code</SubmitButton>
        </form>
      )}

      {step === "code" && (
        <form onSubmit={onCode} className="space-y-4">
          <input
            className={`${inputClass} tracking-[0.4em] text-center`}
            type="text"
            inputMode="numeric"
            placeholder="12345"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoFocus
            required
          />
          <SubmitButton loading={loading}>Sign in</SubmitButton>
        </form>
      )}

      {step === "password" && (
        <form onSubmit={onPassword} className="space-y-4">
          <input
            className={inputClass}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            required
          />
          <SubmitButton loading={loading}>Verify</SubmitButton>
        </form>
      )}

      {error && (
        <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
      )}

      <p className="mt-6 text-center text-xs text-slate-500">
        We use Telegram&apos;s official MTProto API. Your login stays on your server.
      </p>
    </div>
  );
}

function SubmitButton({ loading, children }: { loading: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full rounded-lg bg-sky-500 px-4 py-3 font-medium text-white transition hover:bg-sky-400 disabled:opacity-50"
    >
      {loading ? "Please wait…" : children}
    </button>
  );
}
