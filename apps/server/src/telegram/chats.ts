import bigInt from "big-integer";
import { Api, utils, type TelegramClient } from "telegram";
import type {
  InviteInfoResponse,
  JoinInviteResponse,
  ResolveChatResponse,
} from "@aerogram/shared";
import { rememberEntity, resolveInputChannel, resolveInputUser } from "./entityCache";
import { entityTitle, entityType } from "./normalize";

/**
 * Create a new supergroup or broadcast channel. Both are Telegram "channels";
 * a group is a megagroup, a channel is a broadcast. Returns the marked id so the
 * frontend can navigate straight to /chat/:id.
 */
export async function createChat(
  userId: number,
  client: TelegramClient,
  opts: { title: string; about?: string; kind: "group" | "channel" },
): Promise<{ id: string }> {
  const res = (await client.invoke(
    new Api.channels.CreateChannel({
      title: opts.title,
      about: opts.about ?? "",
      megagroup: opts.kind === "group",
      broadcast: opts.kind === "channel",
    }),
  )) as any;

  const chat = (res.chats as any[])?.find((c) => c.className === "Channel") ?? res.chats?.[0];
  if (!chat) throw new Error("Channel creation returned no chat");

  // Marked id for a channel/supergroup is -(1_000_000_000_000 + rawId).
  const markedId = "-" + bigInt(String(chat.id)).add(bigInt("1000000000000")).toString();
  rememberEntity(userId, markedId, chat, chat.title);
  return { id: markedId };
}

/**
 * Resolve a public @username — channel, group, bot or user — to a marked chat id, so a
 * t.me link in a message can open inside the app. The entity is cached on the way through,
 * which is what lets the chat page load it straight after navigating.
 */
export async function resolvePublicUsername(
  userId: number,
  client: TelegramClient,
  username: string,
): Promise<ResolveChatResponse> {
  return chatFromEntity(userId, await client.getEntity(username.replace(/^@/, "")));
}

/** Describe a chat we hold an entity for, caching it so the chat page can load right away. */
function chatFromEntity(userId: number, entity: unknown): ResolveChatResponse {
  const id = utils.getPeerId(entity as never);
  const title = entityTitle(entity);
  rememberEntity(userId, id, entity, title);
  return { id, title, type: entityType(entity) };
}

/**
 * Look at what a `t.me/+hash` invite points to, without joining anything. Telegram answers
 * with the chat itself when the account is already in it, and with a preview otherwise.
 */
export async function checkInvite(
  userId: number,
  client: TelegramClient,
  hash: string,
): Promise<InviteInfoResponse> {
  const res = (await client.invoke(new Api.messages.CheckChatInvite({ hash }))) as any;
  if (res?.chat) return { chat: chatFromEntity(userId, res.chat) };
  return {
    preview: {
      title: res?.title ?? "this chat",
      memberCount: typeof res?.participantsCount === "number" ? res.participantsCount : undefined,
      requestNeeded: Boolean(res?.requestNeeded),
    },
  };
}

/** Accept an invite. Side-effecting: the account becomes a member (or asks to). */
export async function joinInvite(
  userId: number,
  client: TelegramClient,
  hash: string,
): Promise<JoinInviteResponse> {
  try {
    const res = (await client.invoke(new Api.messages.ImportChatInvite({ hash }))) as any;
    const chat = res?.chats?.[0];
    if (!chat) throw new Error("Join returned no chat");
    return { chat: chatFromEntity(userId, chat) };
  } catch (err) {
    // Approval-gated chats answer this instead of adding the account.
    if ((err as { errorMessage?: string }).errorMessage === "INVITE_REQUEST_SENT") {
      return { requested: true };
    }
    throw err;
  }
}

/** Add members (by marked user id) to a supergroup/channel. */
export async function addMembers(
  userId: number,
  client: TelegramClient,
  chatId: string,
  userIds: string[],
): Promise<void> {
  const channel = await resolveInputChannel(userId, client, chatId);
  const users: Api.TypeInputUser[] = [];
  for (const uid of userIds) users.push(await resolveInputUser(userId, client, uid));
  await client.invoke(new Api.channels.InviteToChannel({ channel, users }));
}
