"use client";

import { io, type Socket } from "socket.io-client";
import type { ServerToClientEvents, ClientToServerEvents } from "@aerogram/shared";
import { API_URL } from "./api";

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

/** Lazily create the shared socket.io connection (cookie-authenticated). */
export function getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> {
  if (!socket) {
    socket = io(API_URL, {
      withCredentials: true,
      path: "/socket.io",
      transports: ["websocket", "polling"],
    });
  }
  return socket;
}
