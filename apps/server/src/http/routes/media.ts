import type { FastifyInstance } from "fastify";
import { clientManager } from "../../telegram/clientManager";
import { downloadForMessage, downloadAvatar, streamMedia } from "../../telegram/media";
import { requireAuth } from "../middleware/session";

export async function mediaRoutes(app: FastifyInstance): Promise<void> {
  // Chat profile photo (small).
  app.get("/media/avatar/:chatId", { preHandler: requireAuth }, async (req, reply) => {
    const { chatId } = req.params as { chatId: string };
    const client = await clientManager.getClient(req.userId!);
    const res = await downloadAvatar(req.userId!, client, chatId);
    if (!res) return reply.code(404).send({ error: "no avatar" });
    return reply
      .header("Content-Type", res.contentType)
      .header("Cache-Control", "private, max-age=3600")
      .send(res.buffer);
  });

  // Message media. ?thumb=1 for inline preview, ?download=1 to force a download.
  app.get("/media/:chatId/:messageId", { preHandler: requireAuth }, async (req, reply) => {
    const { chatId, messageId } = req.params as { chatId: string; messageId: string };
    const q = req.query as { thumb?: string; download?: string };
    const id = Number(messageId);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: "bad message id" });

    const client = await clientManager.getClient(req.userId!);

    // Full media streams directly from Telegram (documents/video); thumbs stay buffered.
    if (q.thumb !== "1") {
      const streamed = await streamMedia(req.userId!, client, chatId, id);
      if (streamed) {
        reply
          .header("Content-Type", streamed.contentType)
          .header("Cache-Control", "private, max-age=86400");
        if (streamed.size) reply.header("Content-Length", String(streamed.size));
        if (q.download === "1") {
          reply.header(
            "Content-Disposition",
            `attachment; filename="${streamed.fileName.replace(/"/g, "")}"`,
          );
        }
        return reply.send(streamed.stream);
      }
    }

    const res = await downloadForMessage(req.userId!, client, chatId, id, q.thumb === "1");
    if (!res) return reply.code(404).send({ error: "no media" });

    reply.header("Content-Type", res.contentType).header("Cache-Control", "private, max-age=86400");
    if (q.download === "1") {
      reply.header("Content-Disposition", `attachment; filename="${res.fileName.replace(/"/g, "")}"`);
    }
    return reply.send(res.buffer);
  });
}
