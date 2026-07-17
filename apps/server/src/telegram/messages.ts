import { type Api, type TelegramClient } from "telegram";
import type { MessageDTO, MessagesResponse } from "@aerogram/shared";
import { normalizeMessage } from "./normalize";
import { resolveInputPeer } from "./entityCache";

/** Fetch a page of history (newest-first), oldest-paginated via offsetId. */
export async function getHistory(
  userId: number,
  client: TelegramClient,
  chatId: string,
  limit = 30,
  offsetId = 0,
): Promise<MessagesResponse> {
  const peer = await resolveInputPeer(userId, client, chatId);
  const messages = await client.getMessages(peer, { limit, offsetId });

  const dtos: MessageDTO[] = [];
  for (const m of messages) {
    // getMessages can include service-message placeholders; skip empties with no content.
    if ((m as { className?: string }).className === "MessageEmpty") continue;
    dtos.push(normalizeMessage(m, chatId));
  }

  const oldest = messages.length ? messages[messages.length - 1] : undefined;
  const nextOffsetId =
    messages.length >= limit && oldest ? (oldest as Api.Message).id : null;

  return { messages: dtos, nextOffsetId };
}

/** Send a text message; returns the created message normalized. */
export async function sendText(
  userId: number,
  client: TelegramClient,
  chatId: string,
  text: string,
  replyToId?: number,
): Promise<MessageDTO> {
  const peer = await resolveInputPeer(userId, client, chatId);
  const sent = await client.sendMessage(peer, { message: text, replyTo: replyToId });
  return normalizeMessage(sent, chatId);
}

/** Fetch a single message by id (used by the media endpoint). */
export async function getMessageById(
  userId: number,
  client: TelegramClient,
  chatId: string,
  messageId: number,
): Promise<Api.Message | undefined> {
  const peer = await resolveInputPeer(userId, client, chatId);
  const messages = await client.getMessages(peer, { ids: [messageId] });
  return messages[0] as Api.Message | undefined;
}
