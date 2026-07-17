"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { MessageDTO } from "@wt/shared";
import { getSocket } from "./ws";

/**
 * Subscribe to live message updates and refresh the relevant queries.
 * Kept intentionally simple: invalidate the affected chat's history and the dialog list.
 */
export function useRealtime(enabled: boolean): void {
  const qc = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    const socket = getSocket();

    const onNew = (payload: { chatId: string; message: MessageDTO }) => {
      qc.invalidateQueries({ queryKey: ["messages", payload.chatId] });
      qc.invalidateQueries({ queryKey: ["dialogs"] });
    };

    socket.on("message:new", onNew);
    socket.on("message:edit", onNew);
    return () => {
      socket.off("message:new", onNew);
      socket.off("message:edit", onNew);
    };
  }, [enabled, qc]);
}
