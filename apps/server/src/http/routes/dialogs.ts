import type { FastifyInstance } from "fastify";
import { clientManager } from "../../telegram/clientManager";
import { listDialogs } from "../../telegram/dialogs";
import { requireAuth } from "../middleware/session";

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);

export async function dialogRoutes(app: FastifyInstance): Promise<void> {
  app.get("/dialogs", { preHandler: requireAuth }, async (req) => {
    const limit = clamp(Number((req.query as { limit?: string }).limit ?? 50) || 50, 1, 200);
    const client = await clientManager.getClient(req.userId!);
    const chats = await listDialogs(req.userId!, client, limit);
    return { chats };
  });
}
