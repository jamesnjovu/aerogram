import bigInt from "big-integer";
import { Api, type TelegramClient } from "telegram";
import type {
  BotCommand,
  ChatInfoDTO,
  ChatType,
  MessagesResponse,
  SharedMediaType,
} from "@aerogram/shared";
import {
  resolveInputPeer,
  resolveInputChannel,
  resolveInputUser,
} from "./entityCache";
import { getEntity } from "../store/db";
import { normalizeMessage } from "./normalize";

async function isMuted(client: TelegramClient, peer: Api.TypeInputPeer): Promise<boolean> {
  try {
    const s = (await client.invoke(
      new Api.account.GetNotifySettings({ peer: new Api.InputNotifyPeer({ peer }) }),
    )) as any;
    const mu = s?.muteUntil;
    return mu != null && Number(mu) > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

/** Full details for a chat (group/channel/user), for the details page. */
export async function getChatInfo(
  userId: number,
  client: TelegramClient,
  chatId: string,
): Promise<ChatInfoDTO> {
  const peer = await resolveInputPeer(userId, client, chatId);
  const row = getEntity(userId, chatId);
  const kind = row?.type ?? "user";

  let title = row?.title ?? "Chat";
  let type: ChatType = "user";
  let username: string | undefined;
  let about: string | undefined;
  let memberCount: number | undefined;
  let link: string | undefined;

  if (kind === "channel") {
    const channel = await resolveInputChannel(userId, client, chatId);
    const full = (await client.invoke(new Api.channels.GetFullChannel({ channel }))) as any;
    const fc = full.fullChat;
    const entity = full.chats?.[0] ?? {};
    title = entity.title ?? title;
    username = entity.username ?? undefined;
    about = fc?.about || undefined;
    memberCount = fc?.participantsCount ?? undefined;
    type = entity.megagroup ? "group" : "channel";
    link = fc?.exportedInvite?.link ?? (username ? `https://t.me/${username}` : undefined);
  } else if (kind === "chat") {
    const full = (await client.invoke(
      new Api.messages.GetFullChat({ chatId: bigInt(String(row!.raw_id)) }),
    )) as any;
    const fc = full.fullChat;
    const entity = full.chats?.[0] ?? {};
    title = entity.title ?? title;
    memberCount = entity.participantsCount ?? undefined;
    about = fc?.about || undefined;
    type = "group";
    link = fc?.exportedInvite?.link ?? undefined;
  } else {
    const input = await resolveInputUser(userId, client, chatId);
    const full = (await client.invoke(new Api.users.GetFullUser({ id: input }))) as any;
    const u = full.users?.[0] ?? {};
    title = [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.username || title;
    username = u.username ?? undefined;
    about = full.fullUser?.about || undefined;
    type = "user";
    link = username ? `https://t.me/${username}` : undefined;
  }

  return {
    id: chatId,
    title,
    type,
    username,
    about,
    memberCount,
    muted: await isMuted(client, peer),
    canLeave: kind === "channel" || kind === "chat",
    link,
  };
}

/** Mute or unmute a chat's notifications. */
export async function setMute(
  userId: number,
  client: TelegramClient,
  chatId: string,
  muted: boolean,
): Promise<void> {
  const peer = await resolveInputPeer(userId, client, chatId);
  await client.invoke(
    new Api.account.UpdateNotifySettings({
      peer: new Api.InputNotifyPeer({ peer }),
      settings: new Api.InputPeerNotifySettings({ muteUntil: muted ? 2147483647 : 0 }),
    }),
  );
}

/** Leave a group or channel. */
export async function leaveChat(
  userId: number,
  client: TelegramClient,
  chatId: string,
): Promise<void> {
  const row = getEntity(userId, chatId);
  const kind = row?.type ?? "user";
  if (kind === "channel") {
    const channel = await resolveInputChannel(userId, client, chatId);
    await client.invoke(new Api.channels.LeaveChannel({ channel }));
  } else if (kind === "chat") {
    await client.invoke(
      new Api.messages.DeleteChatUser({
        chatId: bigInt(String(row!.raw_id)),
        userId: new Api.InputUserSelf(),
      }),
    );
  }
}

function filterFor(type: SharedMediaType): Api.TypeMessagesFilter {
  switch (type) {
    case "media":
      return new Api.InputMessagesFilterPhotoVideo();
    case "file":
      return new Api.InputMessagesFilterDocument();
    case "link":
      return new Api.InputMessagesFilterUrl();
    case "music":
      return new Api.InputMessagesFilterMusic();
    case "voice":
      return new Api.InputMessagesFilterRoundVoice();
    case "gif":
      return new Api.InputMessagesFilterGif();
    default:
      return new Api.InputMessagesFilterEmpty();
  }
}

/** Search a chat's shared media of a given kind (paginated by offsetId). */
export async function searchSharedMedia(
  userId: number,
  client: TelegramClient,
  chatId: string,
  type: SharedMediaType,
  limit = 30,
  offsetId = 0,
): Promise<MessagesResponse> {
  const peer = await resolveInputPeer(userId, client, chatId);
  const res = (await client.invoke(
    new Api.messages.Search({
      peer,
      q: "",
      filter: filterFor(type),
      minDate: 0,
      maxDate: 0,
      offsetId,
      addOffset: 0,
      limit,
      maxId: 0,
      minId: 0,
      hash: bigInt.zero,
    }),
  )) as any;

  const raw: any[] = res?.messages ?? [];
  const messages = raw
    .filter((m) => m.className === "Message")
    .map((m) => normalizeMessage(m, chatId));
  const oldest = raw[raw.length - 1];
  const nextOffsetId = raw.length >= limit && oldest ? oldest.id : null;
  return { messages, nextOffsetId };
}

/** Bot commands for a bot chat (empty for non-bots). */
export async function getBotCommands(
  userId: number,
  client: TelegramClient,
  chatId: string,
): Promise<BotCommand[]> {
  const row = getEntity(userId, chatId);
  if (row?.type !== "user") return [];
  const input = await resolveInputUser(userId, client, chatId);
  const full = (await client.invoke(new Api.users.GetFullUser({ id: input }))) as any;
  if (!full.users?.[0]?.bot) return [];
  const bi = full.fullUser?.botInfo;
  const commands = (Array.isArray(bi) ? bi[0]?.commands : bi?.commands) ?? [];
  return commands.map((c: any) => ({ command: c.command, description: c.description }));
}
