"use client";

import { useParams } from "next/navigation";
import { ChatDetails } from "@/components/ChatDetails";

export default function ChatInfoPage() {
  const params = useParams<{ id: string }>();
  const chatId = decodeURIComponent(String(params.id));
  return <ChatDetails chatId={chatId} key={chatId} />;
}
