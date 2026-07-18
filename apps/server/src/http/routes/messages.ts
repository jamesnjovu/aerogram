import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { clientManager } from "../../telegram/clientManager";
import {
  getHistory,
  sendText,
  forwardMessages,
  deleteMessages,
  editMessage,
  sendAttachment,
  sendLocation,
  sendPoll,
  botCallback,
} from "../../telegram/messages";
import { requireAuth } from "../middleware/session";

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);
const sendSchema = z.object({ text: z.string().min(1).max(4096), replyToId: z.number().int().optional() });
const forwardSchema = z.object({
  toChatId: z.string(),
  messageIds: z.array(z.number().int()).min(1).max(100),
});
const deleteSchema = z.object({ messageIds: z.array(z.number().int()).min(1).max(100) });
const editSchema = z.object({ text: z.string().min(1).max(4096) });
const attachKind = z.enum(["photo", "video", "file", "music", "voice"]);
const callbackSchema = z.object({ data: z.string() });
const locationSchema = z.object({ lat: z.number(), long: z.number() });
const pollSchema = z.object({
  question: z.string().min(1).max(255),
  options: z.array(z.string().min(1).max(100)).min(2).max(10),
  anonymous: z.boolean().optional(),
  quiz: z.boolean().optional(),
  correctOption: z.number().int().min(0).optional(),
});

export async function messageRoutes(app: FastifyInstance): Promise<void> {
  app.get("/messages/:chatId", { preHandler: requireAuth }, async (req) => {
    const { chatId } = req.params as { chatId: string };
    const q = req.query as { limit?: string; offsetId?: string };
    const limit = clamp(Number(q.limit ?? 30) || 30, 1, 100);
    const offsetId = Number(q.offsetId ?? 0) || 0;
    const client = await clientManager.getClient(req.userId!);
    return getHistory(req.userId!, client, chatId, limit, offsetId);
  });

  app.post("/messages/:chatId", { preHandler: requireAuth }, async (req) => {
    const { chatId } = req.params as { chatId: string };
    const { text, replyToId } = sendSchema.parse(req.body);
    const client = await clientManager.getClient(req.userId!);
    const message = await sendText(req.userId!, client, chatId, text, replyToId);
    return { message };
  });

  app.post("/messages/:chatId/forward", { preHandler: requireAuth }, async (req) => {
    const { chatId } = req.params as { chatId: string };
    const { toChatId, messageIds } = forwardSchema.parse(req.body);
    const client = await clientManager.getClient(req.userId!);
    await forwardMessages(req.userId!, client, chatId, toChatId, messageIds);
    return { ok: true };
  });

  app.post("/messages/:chatId/delete", { preHandler: requireAuth }, async (req) => {
    const { chatId } = req.params as { chatId: string };
    const { messageIds } = deleteSchema.parse(req.body);
    const client = await clientManager.getClient(req.userId!);
    await deleteMessages(req.userId!, client, chatId, messageIds);
    return { ok: true };
  });

  app.post("/messages/:chatId/:messageId/edit", { preHandler: requireAuth }, async (req) => {
    const { chatId, messageId } = req.params as { chatId: string; messageId: string };
    const { text } = editSchema.parse(req.body);
    const client = await clientManager.getClient(req.userId!);
    const message = await editMessage(req.userId!, client, chatId, Number(messageId), text);
    return { message };
  });

  // Attachment upload. kind + caption come as query params; the file is the multipart body.
  app.post("/messages/:chatId/attach", { preHandler: requireAuth }, async (req, reply) => {
    const { chatId } = req.params as { chatId: string };
    const q = req.query as { kind?: string; caption?: string };
    const kind = attachKind.parse(q.kind ?? "file");
    const data = await (req as unknown as { file: () => Promise<any> }).file();
    if (!data) return reply.code(400).send({ error: "No file uploaded" });
    const buffer = await data.toBuffer();
    const client = await clientManager.getClient(req.userId!);
    await sendAttachment(req.userId!, client, chatId, {
      kind,
      buffer,
      filename: data.filename ?? "file",
      caption: q.caption,
    });
    return { ok: true };
  });

  app.post("/messages/:chatId/location", { preHandler: requireAuth }, async (req) => {
    const { chatId } = req.params as { chatId: string };
    const { lat, long } = locationSchema.parse(req.body);
    const client = await clientManager.getClient(req.userId!);
    await sendLocation(req.userId!, client, chatId, lat, long);
    return { ok: true };
  });

  app.post("/messages/:chatId/poll", { preHandler: requireAuth }, async (req) => {
    const { chatId } = req.params as { chatId: string };
    const { question, options, anonymous, quiz, correctOption } = pollSchema.parse(req.body);
    const client = await clientManager.getClient(req.userId!);
    await sendPoll(req.userId!, client, chatId, question, options, {
      anonymous: anonymous ?? true,
      quiz: quiz ?? false,
      correctOption,
    });
    return { ok: true };
  });

  app.post("/messages/:chatId/:messageId/callback", { preHandler: requireAuth }, async (req) => {
    const { chatId, messageId } = req.params as { chatId: string; messageId: string };
    const { data } = callbackSchema.parse(req.body);
    const client = await clientManager.getClient(req.userId!);
    return botCallback(req.userId!, client, chatId, Number(messageId), data);
  });
}
