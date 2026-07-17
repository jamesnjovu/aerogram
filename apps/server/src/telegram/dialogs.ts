import { type TelegramClient } from "telegram";
import type { ChatDTO } from "@aerogram/shared";
import { normalizeDialog } from "./normalize";
import { rememberEntity } from "./entityCache";
import { getParsedFilters, dialogMatchesFilter } from "./folders";

/**
 * Fetch the user's dialogs, cache their entities, and normalize to ChatDTOs.
 * When folderId > 0, only dialogs belonging to that folder are returned.
 */
export async function listDialogs(
  userId: number,
  client: TelegramClient,
  limit = 50,
  folderId = 0,
): Promise<ChatDTO[]> {
  const dialogs = await client.getDialogs({ limit });

  const filter =
    folderId > 0
      ? (await getParsedFilters(client)).find((f) => f.id === folderId) ?? null
      : null;

  const chats: ChatDTO[] = [];
  for (const d of dialogs) {
    rememberEntity(userId, String(d.id), d.entity, (d as { title?: string }).title);
    if (filter && !dialogMatchesFilter(d, filter)) continue;
    chats.push(normalizeDialog(d));
  }
  return chats;
}
