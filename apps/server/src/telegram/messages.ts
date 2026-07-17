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

/** Forward messages from one chat to another. */
export async function forwardMessages(
  userId: number,
  client: TelegramClient,
  fromChatId: string,
  toChatId: string,
  messageIds: number[],
): Promise<void> {
  const fromPeer = await resolveInputPeer(userId, client, fromChatId);
  const toPeer = await resolveInputPeer(userId, client, toChatId);
  await client.forwardMessages(toPeer, { messages: messageIds, fromPeer });
}

/** Delete messages (revoke = for everyone where allowed). */
export async function deleteMessages(
  userId: number,
  client: TelegramClient,
  chatId: string,
  messageIds: number[],
): Promise<void> {
  const peer = await resolveInputPeer(userId, client, chatId);
  await client.deleteMessages(peer, messageIds, { revoke: true });
}

/** Edit the text of one of the user's own messages. */
export async function editMessage(
  userId: number,
  client: TelegramClient,
  chatId: string,
  messageId: number,
  text: string,
): Promise<MessageDTO> {
  const peer = await resolveInputPeer(userId, client, chatId);
  const edited = await client.editMessage(peer, { message: messageId, text });
  return normalizeMessage(edited, chatId);
}
