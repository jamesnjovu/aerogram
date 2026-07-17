import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import { ZodError } from "zod";
import { config } from "./config";
import { authRoutes } from "./http/routes/auth";
import { dialogRoutes } from "./http/routes/dialogs";
import { messageRoutes } from "./http/routes/messages";
import { mediaRoutes } from "./http/routes/media";
import { createSocketServer } from "./ws/server";
import { AuthError } from "./telegram/auth";
import { UnauthorizedError } from "./telegram/clientManager";

const app = Fastify({
  logger: { level: "info", transport: undefined },
  bodyLimit: 8 * 1024 * 1024,
});

await app.register(cors, { origin: config.WEB_ORIGIN, credentials: true });
await app.register(cookie);

app.get("/health", async () => ({ ok: true }));

await authRoutes(app);
await dialogRoutes(app);
await messageRoutes(app);
await mediaRoutes(app);

app.setErrorHandler((err, req, reply) => {
  if (err instanceof ZodError) {
    return reply.code(400).send({ error: "Invalid request", issues: err.issues });
  }
  if (err instanceof AuthError) {
    return reply.code(400).send({ error: err.message, code: err.code, seconds: err.seconds });
  }
  if (err instanceof UnauthorizedError) {
    return reply.code(401).send({ error: "unauthorized" });
  }
  // GramJS FLOOD_WAIT and other RPC errors surface a helpful message.
  const rpc = (err as { errorMessage?: string }).errorMessage;
  if (rpc) {
    req.log.warn({ rpc }, "telegram rpc error");
    return reply.code(502).send({ error: `Telegram error: ${rpc}` });
  }
  req.log.error(err);
  return reply.code(500).send({ error: "Internal server error" });
});

// Attach socket.io to Fastify's underlying HTTP server, then start listening.
createSocketServer(app.server);

await app.listen({ port: config.PORT, host: "0.0.0.0" });
app.log.info(`Web Telegram backend listening on http://localhost:${config.PORT}`);
