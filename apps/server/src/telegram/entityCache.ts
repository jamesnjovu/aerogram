import bigInt from "big-integer";
import { Api, type TelegramClient } from "telegram";
import { getEntity, saveEntity, type EntityRow } from "../store/db";

/**
 * Resolves a marked chat id (as exposed to the frontend) back into a GramJS InputPeer.
 *
 * We persist each chat's (raw id, access_hash, peer kind) in SQLite so that InputPeers can be
 * rebuilt across server restarts without any extra API round-trips. On a cache miss we prime the
 * cache from the dialog list and retry.
 */

type PeerKind = "user" | "chat" | "channel";

function peerKind(entity: unknown): PeerKind {
  const cls = (entity as { className?: string })?.className;
  if (cls === "Channel" || cls === "ChannelForbidden") return "channel";
  if (cls === "Chat" || cls === "ChatForbidden") return "chat";
  return "user";
}

/** Persist an entity so we can rebuild its InputPeer later. */
export function rememberEntity(
  userId: number,
  markedId: string,
  entity: unknown,
  title?: string,
): void {
  if (!entity) return;
  const e = entity as { id?: unknown; accessHash?: unknown };
  if (e.id === undefined || e.id === null) return;
  saveEntity(userId, {
    markedId,
    rawId: String(e.id),
    type: peerKind(entity),
    accessHash: e.accessHash !== undefined && e.accessHash !== null ? String(e.accessHash) : null,
    title: title ?? null,
  });
}

function buildInputPeer(row: EntityRow): Api.TypeInputPeer {
  const rawId = bigInt(row.raw_id);
  const accessHash = bigInt(row.access_hash ?? "0");
  switch (row.type) {
    case "user":
      return new Api.InputPeerUser({ userId: rawId, accessHash });
    case "channel":
      return new Api.InputPeerChannel({ channelId: rawId, accessHash });
    default:
      return new Api.InputPeerChat({ chatId: rawId });
  }
}

async function primeEntities(userId: number, client: TelegramClient): Promise<void> {
  const dialogs = await client.getDialogs({ limit: 200 });
  for (const d of dialogs) {
    rememberEntity(userId, String(d.id), d.entity, (d as { title?: string }).title);
  }
}

export async function resolveInputPeer(
  userId: number,
  client: TelegramClient,
  markedId: string,
): Promise<Api.TypeInputPeer> {
  const cached = getEntity(userId, markedId);
  if (cached) return buildInputPeer(cached);

  try {
    return (await client.getInputEntity(bigInt(markedId))) as Api.TypeInputPeer;
  } catch {
    await primeEntities(userId, client);
    const again = getEntity(userId, markedId);
    if (again) return buildInputPeer(again);
    return (await client.getInputEntity(bigInt(markedId))) as Api.TypeInputPeer;
  }
}

/** Resolve a user's marked id into an InputUser (for invites, etc.). */
export async function resolveInputUser(
  userId: number,
  client: TelegramClient,
  markedId: string,
): Promise<Api.TypeInputUser> {
  const peer = (await resolveInputPeer(userId, client, markedId)) as any;
  if (peer.className === "InputPeerUser") {
    return new Api.InputUser({ userId: peer.userId, accessHash: peer.accessHash });
  }
  if (peer.className === "InputPeerSelf") return new Api.InputUserSelf();
  throw new Error("Not a user");
}

/** Resolve a channel/supergroup's marked id into an InputChannel. */
export async function resolveInputChannel(
  userId: number,
  client: TelegramClient,
  markedId: string,
): Promise<Api.TypeInputChannel> {
  const peer = (await resolveInputPeer(userId, client, markedId)) as any;
  if (peer.className === "InputPeerChannel") {
    return new Api.InputChannel({ channelId: peer.channelId, accessHash: peer.accessHash });
  }
  throw new Error("Not a channel");
}
