"use client";

import { useParams } from "next/navigation";
import { MessageView } from "@/components/MessageView";

export default function ChatPage() {
  const params = useParams<{ id: string }>();
  const chatId = decodeURIComponent(String(params.id));
  // key resets MessageView state (scroll, pages) when switching chats.
  return <MessageView chatId={chatId} key={chatId} />;
}
