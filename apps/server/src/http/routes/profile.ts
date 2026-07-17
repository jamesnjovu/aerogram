import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { clientManager } from "../../telegram/clientManager";
import {
  getProfile,
  updateProfile,
  updateUsername,
  updateBirthday,
  setProfilePhoto,
  deleteProfilePhoto,
  downloadSelfPhoto,
} from "../../telegram/profile";
import { requireAuth } from "../middleware/session";

const profileSchema = z.object({
  firstName: z.string().max(64).optional(),
  lastName: z.string().max(64).optional(),
  bio: z.string().max(140).optional(),
});
const usernameSchema = z.object({ username: z.string().max(32) });
const birthdaySchema = z.object({
  day: z.number().int().min(1).max(31),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(1900).max(2100).optional(),
});

export async function profileRoutes(app: FastifyInstance): Promise<void> {
  app.get("/profile", { preHandler: requireAuth }, async (req) => {
    const client = await clientManager.getClient(req.userId!);
    return getProfile(client);
  });

  app.get("/profile/avatar", { preHandler: requireAuth }, async (req, reply) => {
    const client = await clientManager.getClient(req.userId!);
    const buffer = await downloadSelfPhoto(client);
    if (!buffer) return reply.code(404).send({ error: "no avatar" });
    return reply
      .header("Content-Type", "image/jpeg")
      .header("Cache-Control", "no-store")
      .send(buffer);
  });

  app.post("/profile", { preHandler: requireAuth }, async (req) => {
    const data = profileSchema.parse(req.body);
    const client = await clientManager.getClient(req.userId!);
    await updateProfile(client, data);
    return getProfile(client);
  });

  app.post("/profile/username", { preHandler: requireAuth }, async (req) => {
    const { username } = usernameSchema.parse(req.body);
    const client = await clientManager.getClient(req.userId!);
    await updateUsername(client, username);
    return getProfile(client);
  });

  app.post("/profile/birthday", { preHandler: requireAuth }, async (req) => {
    const b = birthdaySchema.parse(req.body);
    const client = await clientManager.getClient(req.userId!);
    await updateBirthday(client, b);
    return getProfile(client);
  });

  app.delete("/profile/birthday", { preHandler: requireAuth }, async (req) => {
    const client = await clientManager.getClient(req.userId!);
    await updateBirthday(client, null);
    return getProfile(client);
  });

  app.post("/profile/photo", { preHandler: requireAuth }, async (req, reply) => {
    const data = await (req as unknown as { file: () => Promise<any> }).file();
    if (!data) return reply.code(400).send({ error: "No file uploaded" });
    const buffer = await data.toBuffer();
    const client = await clientManager.getClient(req.userId!);
    await setProfilePhoto(client, buffer, data.filename ?? "avatar.jpg");
    return getProfile(client);
  });

  app.delete("/profile/photo", { preHandler: requireAuth }, async (req) => {
    const client = await clientManager.getClient(req.userId!);
    await deleteProfilePhoto(client);
    return getProfile(client);
  });
}
