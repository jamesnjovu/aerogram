import { type TelegramClient } from "telegram";
import type { ChatDTO } from "@wt/shared";
import { normalizeDialog } from "./normalize";
import { rememberEntity } from "./entityCache";

/** Fetch the user's dialogs, cache their entities, and normalize to ChatDTOs. */
export async function listDialogs(
  userId: number,
  client: TelegramClient,
  limit = 50,
): Promise<ChatDTO[]> {
  const dialogs = await client.getDialogs({ limit });
  const chats: ChatDTO[] = [];
  for (const d of dialogs) {
    rememberEntity(userId, String(d.id), d.entity, (d as { title?: string }).title);
    chats.push(normalizeDialog(d));
  }
  return chats;
}
