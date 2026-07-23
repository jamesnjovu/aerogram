import { Api, type TelegramClient } from "telegram";
import { CustomFile } from "telegram/client/uploads";
import { generateRandomLong } from "telegram/Helpers";
import type {
  AttachmentKind,
  BotCallbackResponse,
  MessageDTO,
  MessagesResponse,
} from "@aerogram/shared";
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

/**
 * Mark the chat read up to `maxId` (0 = everything), which is what clears its unread badge —
 * for the account as a whole, not just this client. Channels use a different RPC than
 * users/basic groups, so the peer kind decides.
 */
export async function markRead(
  userId: number,
  client: TelegramClient,
  chatId: string,
  maxId = 0,
): Promise<void> {
  const peer = await resolveInputPeer(userId, client, chatId);
  if (peer instanceof Api.InputPeerChannel) {
    await client.invoke(
      new Api.channels.ReadHistory({
        channel: new Api.InputChannel({ channelId: peer.channelId, accessHash: peer.accessHash }),
        maxId,
      }),
    );
    return;
  }
  await client.invoke(new Api.messages.ReadHistory({ peer, maxId }));
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

/** Send an uploaded file as a photo / video / document / music / voice note. */
export async function sendAttachment(
  userId: number,
  client: TelegramClient,
  chatId: string,
  opts: { kind: AttachmentKind; buffer: Buffer; filename: string; caption?: string },
): Promise<void> {
  const peer = await resolveInputPeer(userId, client, chatId);
  const file = new CustomFile(opts.filename || "file", opts.buffer.length, "", opts.buffer);
  const params: Record<string, unknown> = { file, caption: opts.caption };
  switch (opts.kind) {
    case "file":
      params.forceDocument = true;
      break;
    case "video":
      params.supportsStreaming = true;
      break;
    case "voice":
      params.voiceNote = true;
      break;
    case "music":
      params.attributes = [
        new Api.DocumentAttributeAudio({ duration: 0, title: opts.filename, voice: false }),
      ];
      break;
    default:
      break; // photo → GramJS sends as a photo
  }
  await client.sendFile(peer, params as never);
}

/** Press an inline callback button; returns the bot's answer (toast/alert/url). */
export async function botCallback(
  userId: number,
  client: TelegramClient,
  chatId: string,
  messageId: number,
  dataB64: string,
): Promise<BotCallbackResponse> {
  const peer = await resolveInputPeer(userId, client, chatId);
  const res = (await client.invoke(
    new Api.messages.GetBotCallbackAnswer({
      peer,
      msgId: messageId,
      data: Buffer.from(dataB64, "base64"),
    }),
  )) as any;
  return { text: res.message ?? undefined, alert: Boolean(res.alert), url: res.url ?? undefined };
}

/** Send a geo location. */
export async function sendLocation(
  userId: number,
  client: TelegramClient,
  chatId: string,
  lat: number,
  long: number,
): Promise<void> {
  const peer = await resolveInputPeer(userId, client, chatId);
  await client.invoke(
    new Api.messages.SendMedia({
      peer,
      media: new Api.InputMediaGeoPoint({ geoPoint: new Api.InputGeoPoint({ lat, long }) }),
      message: "",
      randomId: generateRandomLong(),
    }),
  );
}

/** Send a poll (supports anonymous toggle and quiz mode). */
export async function sendPoll(
  userId: number,
  client: TelegramClient,
  chatId: string,
  question: string,
  options: string[],
  opts: { anonymous: boolean; quiz: boolean; correctOption?: number } = {
    anonymous: true,
    quiz: false,
  },
): Promise<void> {
  const peer = await resolveInputPeer(userId, client, chatId);
  const answers = options.map(
    (opt, i) =>
      new Api.PollAnswer({
        text: new Api.TextWithEntities({ text: opt, entities: [] }),
        option: Buffer.from([i]),
      }),
  );
  const poll = new Api.Poll({
    id: generateRandomLong(),
    question: new Api.TextWithEntities({ text: question, entities: [] }),
    answers,
    quiz: opts.quiz || undefined,
    // Polls are anonymous by default; publicVoters makes votes visible.
    publicVoters: opts.anonymous ? undefined : true,
  });
  const correctAnswers =
    opts.quiz && opts.correctOption != null ? [Buffer.from([opts.correctOption])] : undefined;
  await client.invoke(
    new Api.messages.SendMedia({
      peer,
      media: new Api.InputMediaPoll({ poll, correctAnswers }),
      message: "",
      randomId: generateRandomLong(),
    }),
  );
}
