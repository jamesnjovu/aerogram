import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { MeDTO } from "@wt/shared";
import { clientManager } from "../../telegram/clientManager";
import { signInWithCode, checkPassword } from "../../telegram/auth";
import { upsertUser, getUserById, type UserRow } from "../../store/db";
import { issueSession, clearSession, requireAuth } from "../middleware/session";

const sendCodeSchema = z.object({ phone: z.string().min(5).max(20) });
const signInSchema = z.object({ tempToken: z.string(), code: z.string().min(1).max(10) });
const passwordSchema = z.object({ tempToken: z.string(), password: z.string().min(1) });

function meFromRow(u: UserRow): MeDTO {
  return {
    id: u.tg_user_id,
    firstName: u.first_name ?? "",
    lastName: u.last_name ?? undefined,
    username: u.username ?? undefined,
    phone: u.phone ?? undefined,
  };
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post("/auth/send-code", async (req) => {
    const { phone } = sendCodeSchema.parse(req.body);
    const { tempToken } = await clientManager.createPending(phone);
    return { tempToken };
  });

  app.post("/auth/sign-in", async (req, reply) => {
    const { tempToken, code } = signInSchema.parse(req.body);
    const pending = clientManager.getPending(tempToken);
    if (!pending) return reply.code(400).send({ error: "Login session expired. Start again." });

    const result = await signInWithCode(pending.client, pending.phone, pending.phoneCodeHash, code);
    if ("needPassword" in result) return { needPassword: true };

    const user = upsertUser({
      tgUserId: result.me.id,
      phone: result.me.phone ?? pending.phone,
      firstName: result.me.firstName,
      lastName: result.me.lastName,
      username: result.me.username,
    });
    await clientManager.finalizeLogin(tempToken, user.id);
    issueSession(reply, user.id);
    return { me: result.me };
  });

  app.post("/auth/password", async (req, reply) => {
    const { tempToken, password } = passwordSchema.parse(req.body);
    const pending = clientManager.getPending(tempToken);
    if (!pending) return reply.code(400).send({ error: "Login session expired. Start again." });

    const result = await checkPassword(pending.client, password);
    const user = upsertUser({
      tgUserId: result.me.id,
      phone: result.me.phone ?? pending.phone,
      firstName: result.me.firstName,
      lastName: result.me.lastName,
      username: result.me.username,
    });
    await clientManager.finalizeLogin(tempToken, user.id);
    issueSession(reply, user.id);
    return { me: result.me };
  });

  app.get("/auth/me", { preHandler: requireAuth }, async (req, reply) => {
    const u = getUserById(req.userId!);
    if (!u) return reply.code(401).send({ error: "unauthorized" });
    return { me: meFromRow(u) };
  });

  app.post("/auth/logout", { preHandler: requireAuth }, async (req, reply) => {
    await clientManager.logout(req.userId!);
    clearSession(reply);
    return { ok: true };
  });
}
