import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { clientManager } from "../../telegram/clientManager";
import { getHistory, sendText } from "../../telegram/messages";
import { requireAuth } from "../middleware/session";

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);
const sendSchema = z.object({ text: z.string().min(1).max(4096), replyToId: z.number().int().optional() });

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
}
