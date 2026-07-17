import bigInt from "big-integer";
import { Api, type TelegramClient } from "telegram";
import { rememberEntity, resolveInputChannel, resolveInputUser } from "./entityCache";

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
