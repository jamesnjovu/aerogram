import jwt from "jsonwebtoken";
import type { FastifyReply, FastifyRequest } from "fastify";
import { config } from "../../config";

const COOKIE_NAME = "wt_session";
const MAX_AGE = 30 * 24 * 3600; // 30 days (seconds)
const isSecure = config.WEB_ORIGIN.startsWith("https");

declare module "fastify" {
  interface FastifyRequest {
    userId?: number;
  }
}

export function issueSession(reply: FastifyReply, userId: number): void {
  const token = jwt.sign({ uid: userId }, config.JWT_SECRET, { expiresIn: MAX_AGE });
  reply.setCookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax", // localhost:3000 and :4000 are same-site (site ignores port)
    secure: isSecure,
    path: "/",
    maxAge: MAX_AGE,
  });
}

export function clearSession(reply: FastifyReply): void {
  reply.clearCookie(COOKIE_NAME, { path: "/" });
}

function verifyToken(token: string): number | null {
  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as { uid: number };
    return typeof payload.uid === "number" ? payload.uid : null;
  } catch {
    return null;
  }
}

export function readUserId(req: FastifyRequest): number | null {
  const token = req.cookies?.[COOKIE_NAME];
  return token ? verifyToken(token) : null;
}

/** Parse the session user id straight from a raw Cookie header (used by socket.io). */
export function readUserIdFromCookieHeader(header: string | undefined): number | null {
  if (!header) return null;
  const entry = header
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${COOKIE_NAME}=`));
  if (!entry) return null;
  const token = decodeURIComponent(entry.slice(COOKIE_NAME.length + 1));
  return verifyToken(token);
}

/** Fastify preHandler: require a valid session, populating req.userId. */
export async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const uid = readUserId(req);
  if (!uid) {
    await reply.code(401).send({ error: "unauthorized" });
    return;
  }
  req.userId = uid;
}
