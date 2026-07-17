import bigInt from "big-integer";
import { Api, type TelegramClient } from "telegram";
import type { ContactDTO } from "@aerogram/shared";
import { rememberEntity } from "./entityCache";

/** List the user's saved contacts, caching their entities so direct chats resolve. */
export async function listContacts(
  userId: number,
  client: TelegramClient,
): Promise<ContactDTO[]> {
  const res = (await client.invoke(
    new Api.contacts.GetContacts({ hash: bigInt.zero }),
  )) as any;

  const users: any[] = res?.users ?? [];
  const out: ContactDTO[] = [];
  for (const u of users) {
    if (u.className !== "User" || u.self) continue;
    const name =
      [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.username || "Unknown";
    // A user's marked id is its (positive) id.
    rememberEntity(userId, String(u.id), u, name);
    out.push({
      id: String(u.id),
      name,
      username: u.username ?? undefined,
      phone: u.phone ?? undefined,
      hasPhoto: Boolean(u.photo && u.photo.className !== "UserProfilePhotoEmpty"),
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}
