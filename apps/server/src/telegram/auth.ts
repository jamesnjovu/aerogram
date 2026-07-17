import { Api, type TelegramClient } from "telegram";
import { computeCheck } from "telegram/Password";
import type { MeDTO } from "@aerogram/shared";
import { normalizeMe } from "./normalize";

/** A user-facing auth error with a stable machine code. */
export class AuthError extends Error {
  constructor(
    public code: string,
    message: string,
    public seconds?: number,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

function rpcMessage(e: unknown): string {
  return (
    (e as { errorMessage?: string })?.errorMessage ??
    (e as { message?: string })?.message ??
    "UNKNOWN"
  );
}

function mapAuthError(e: unknown): AuthError {
  const raw = rpcMessage(e);
  if (raw.startsWith("FLOOD_WAIT_")) {
    const seconds = Number(raw.slice("FLOOD_WAIT_".length)) || 0;
    return new AuthError(
      "FLOOD_WAIT",
      `Too many attempts. Try again in ${seconds}s.`,
      seconds,
    );
  }
  const friendly: Record<string, string> = {
    PHONE_CODE_INVALID: "That code is incorrect.",
    PHONE_CODE_EXPIRED: "That code has expired — request a new one.",
    PHONE_NUMBER_INVALID: "That phone number is invalid.",
    PHONE_NUMBER_BANNED: "This phone number is banned from Telegram.",
    PASSWORD_HASH_INVALID: "That 2FA password is incorrect.",
    PHONE_NUMBER_UNOCCUPIED: "No Telegram account exists for that number.",
  };
  return new AuthError(raw, friendly[raw] ?? "Authentication failed. Please try again.");
}

/** Complete sign-in with the SMS/app code. Returns needPassword when 2FA is enabled. */
export async function signInWithCode(
  client: TelegramClient,
  phone: string,
  phoneCodeHash: string,
  code: string,
): Promise<{ needPassword: true } | { me: MeDTO }> {
  try {
    await client.invoke(
      new Api.auth.SignIn({ phoneNumber: phone, phoneCodeHash, phoneCode: code }),
    );
  } catch (e) {
    if (rpcMessage(e) === "SESSION_PASSWORD_NEEDED") return { needPassword: true };
    throw mapAuthError(e);
  }
  const me = (await client.getMe()) as Api.User;
  return { me: normalizeMe(me) };
}

/** Complete the 2FA cloud-password step via SRP. */
export async function checkPassword(
  client: TelegramClient,
  password: string,
): Promise<{ me: MeDTO }> {
  try {
    const pwd = await client.invoke(new Api.account.GetPassword());
    const srp = await computeCheck(pwd, password);
    await client.invoke(new Api.auth.CheckPassword({ password: srp }));
  } catch (e) {
    throw mapAuthError(e);
  }
  const me = (await client.getMe()) as Api.User;
  return { me: normalizeMe(me) };
}

export { mapAuthError };
