import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { clientManager } from "../../telegram/clientManager";
import { createChat, addMembers } from "../../telegram/chats";
import { listFolders } from "../../telegram/folders";
import { listCalls } from "../../telegram/calls";
import { listContacts } from "../../telegram/contacts";
import {
  getChatInfo,
  setMute,
  leaveChat,
  searchSharedMedia,
  getBotCommands,
} from "../../telegram/chatInfo";
import { requireAuth } from "../middleware/session";

const createSchema = z.object({
  title: z.string().min(1).max(128),
  about: z.string().max(255).optional(),
});
const membersSchema = z.object({ userIds: z.array(z.string()).min(1).max(100) });
const muteSchema = z.object({ muted: z.boolean() });
const mediaType = z.enum(["media", "file", "link", "music", "voice", "gif"]);
const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);

export async function chatRoutes(app: FastifyInstance): Promise<void> {
  app.post("/chats/group", { preHandler: requireAuth }, async (req) => {
    const { title, about } = createSchema.parse(req.body);
    const client = await clientManager.getClient(req.userId!);
    return createChat(req.userId!, client, { title, about, kind: "group" });
  });

  app.post("/chats/channel", { preHandler: requireAuth }, async (req) => {
    const { title, about } = createSchema.parse(req.body);
    const client = await clientManager.getClient(req.userId!);
    return createChat(req.userId!, client, { title, about, kind: "channel" });
  });

  app.get("/folders", { preHandler: requireAuth }, async (req) => {
    const client = await clientManager.getClient(req.userId!);
    return { folders: await listFolders(client) };
  });

  app.get("/calls", { preHandler: requireAuth }, async (req) => {
    const client = await clientManager.getClient(req.userId!);
    return { calls: await listCalls(client) };
  });

  app.get("/contacts", { preHandler: requireAuth }, async (req) => {
    const client = await clientManager.getClient(req.userId!);
    return { contacts: await listContacts(req.userId!, client) };
  });

  app.post("/chats/:chatId/members", { preHandler: requireAuth }, async (req) => {
    const { chatId } = req.params as { chatId: string };
    const { userIds } = membersSchema.parse(req.body);
    const client = await clientManager.getClient(req.userId!);
    await addMembers(req.userId!, client, chatId, userIds);
    return { ok: true };
  });

  app.get("/chats/:chatId/info", { preHandler: requireAuth }, async (req) => {
    const { chatId } = req.params as { chatId: string };
    const client = await clientManager.getClient(req.userId!);
    return getChatInfo(req.userId!, client, chatId);
  });

  app.post("/chats/:chatId/mute", { preHandler: requireAuth }, async (req) => {
    const { chatId } = req.params as { chatId: string };
    const { muted } = muteSchema.parse(req.body);
    const client = await clientManager.getClient(req.userId!);
    await setMute(req.userId!, client, chatId, muted);
    return { ok: true };
  });

  app.post("/chats/:chatId/leave", { preHandler: requireAuth }, async (req) => {
    const { chatId } = req.params as { chatId: string };
    const client = await clientManager.getClient(req.userId!);
    await leaveChat(req.userId!, client, chatId);
    return { ok: true };
  });

  app.get("/chats/:chatId/media", { preHandler: requireAuth }, async (req) => {
    const { chatId } = req.params as { chatId: string };
    const q = req.query as { type?: string; offsetId?: string; limit?: string };
    const type = mediaType.parse(q.type ?? "media");
    const offsetId = Number(q.offsetId ?? 0) || 0;
    const limit = clamp(Number(q.limit ?? 30) || 30, 1, 100);
    const client = await clientManager.getClient(req.userId!);
    return searchSharedMedia(req.userId!, client, chatId, type, limit, offsetId);
  });

  app.get("/chats/:chatId/bot", { preHandler: requireAuth }, async (req) => {
    const { chatId } = req.params as { chatId: string };
    const client = await clientManager.getClient(req.userId!);
    return { commands: await getBotCommands(req.userId!, client, chatId) };
  });
}
