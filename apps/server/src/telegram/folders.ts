import bigInt from "big-integer";
import { Api, type TelegramClient } from "telegram";
import type { FolderDTO } from "@aerogram/shared";

/**
 * Dialog folders (chat filters). We parse Telegram's filter definitions into a form we can
 * evaluate against the dialog list so folders actually filter the chat list.
 */

export interface ParsedFilter {
  id: number;
  title: string;
  emoticon?: string;
  contacts: boolean;
  nonContacts: boolean;
  groups: boolean;
  broadcasts: boolean;
  bots: boolean;
  excludeMuted: boolean;
  excludeRead: boolean;
  excludeArchived: boolean;
  include: Set<string>;
  exclude: Set<string>;
  pinned: Set<string>;
}

/** Marked id (as used for dialogs) for a filter's InputPeer entry. */
function inputPeerMarkedId(p: any): string | null {
  switch (p?.className) {
    case "InputPeerUser":
      return String(p.userId);
    case "InputPeerChat":
      return "-" + String(p.chatId);
    case "InputPeerChannel":
      return "-" + bigInt(String(p.channelId)).add(bigInt("1000000000000")).toString();
    default:
      return null;
  }
}

function toMarkedSet(peers: any[] | undefined): Set<string> {
  const s = new Set<string>();
  for (const p of peers ?? []) {
    const id = inputPeerMarkedId(p);
    if (id) s.add(id);
  }
  return s;
}

function parseFilter(f: any): ParsedFilter {
  return {
    id: f.id ?? 0,
    title: typeof f.title === "string" ? f.title : (f.title?.text ?? "Folder"),
    emoticon: f.emoticon ?? undefined,
    contacts: !!f.contacts,
    nonContacts: !!f.nonContacts,
    groups: !!f.groups,
    broadcasts: !!f.broadcasts,
    bots: !!f.bots,
    excludeMuted: !!f.excludeMuted,
    excludeRead: !!f.excludeRead,
    excludeArchived: !!f.excludeArchived,
    include: toMarkedSet(f.includePeers),
    exclude: toMarkedSet(f.excludePeers),
    pinned: toMarkedSet(f.pinnedPeers),
  };
}

/** Fetch and parse the user's non-default folders. */
export async function getParsedFilters(client: TelegramClient): Promise<ParsedFilter[]> {
  const res = (await client.invoke(new Api.messages.GetDialogFilters())) as any;
  const filters: any[] = res?.filters ?? res ?? [];
  return filters
    .filter((f) => f.className === "DialogFilter" || f.className === "DialogFilterChatlist")
    .map(parseFilter);
}

/** Folder list for the UI (id 0 is the built-in "All chats"). */
export async function listFolders(client: TelegramClient): Promise<FolderDTO[]> {
  const filters = await getParsedFilters(client);
  return [
    { id: 0, title: "All chats" },
    ...filters.map((f) => ({ id: f.id, title: f.title, emoticon: f.emoticon })),
  ];
}

function isMuted(dialog: any): boolean {
  const mu = dialog?.dialog?.notifySettings?.muteUntil;
  if (mu === undefined || mu === null) return false;
  return Number(mu) > Math.floor(Date.now() / 1000);
}

/** Whether a GramJS Dialog belongs to a parsed folder. */
export function dialogMatchesFilter(dialog: any, filter: ParsedFilter): boolean {
  const id = String(dialog.id);
  if (filter.exclude.has(id)) return false;
  if (filter.include.has(id) || filter.pinned.has(id)) return true;

  const e = dialog.entity ?? {};
  const isUser = e.className === "User";
  const isBot = isUser && !!e.bot;
  const isContact = isUser && !!e.contact;
  const isGroup =
    e.className === "Chat" ||
    e.className === "ChatForbidden" ||
    (e.className === "Channel" && !!e.megagroup);
  const isBroadcast = e.className === "Channel" && !e.megagroup;

  let match = false;
  if (filter.contacts && isContact) match = true;
  if (filter.nonContacts && isUser && !isContact && !isBot) match = true;
  if (filter.groups && isGroup) match = true;
  if (filter.broadcasts && isBroadcast) match = true;
  if (filter.bots && isBot) match = true;
  if (!match) return false;

  if (filter.excludeArchived && dialog.archived) return false;
  if (filter.excludeRead && (dialog.unreadCount ?? 0) === 0 && !dialog.dialog?.unreadMark) {
    return false;
  }
  if (filter.excludeMuted && isMuted(dialog)) return false;
  return true;
}
