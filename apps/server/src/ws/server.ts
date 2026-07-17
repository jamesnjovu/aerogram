import type { Server as HttpServer } from "node:http";
import { Server as IOServer } from "socket.io";
import type { ServerToClientEvents, ClientToServerEvents } from "@aerogram/shared";
import { config } from "../config";
import { clientManager } from "../telegram/clientManager";
import { readUserIdFromCookieHeader } from "../http/middleware/session";

/**
 * socket.io server for live updates. Each authenticated browser joins a per-user room
 * (`user:<id>`). The clientManager pushes normalized new-message events into that room.
 */
export function createSocketServer(httpServer: HttpServer): IOServer {
  const io = new IOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: config.WEB_ORIGIN, credentials: true },
    path: "/socket.io",
  });

  io.on("connection", async (socket) => {
    const userId = readUserIdFromCookieHeader(socket.handshake.headers.cookie);
    if (!userId) {
      socket.disconnect(true);
      return;
    }
    socket.join(`user:${userId}`);

    // Ensure the MTProto client is connected so its update stream starts flowing.
    try {
      await clientManager.getClient(userId);
    } catch {
      // Session no longer valid — tell the client to re-auth.
      socket.disconnect(true);
    }
  });

  // Route new-message events from any user's client into that user's room.
  clientManager.setEmitter((userId, event, payload) => {
    io.to(`user:${userId}`).emit(event, payload as never);
  });

  return io;
}
