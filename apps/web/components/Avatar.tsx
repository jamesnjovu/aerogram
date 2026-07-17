"use client";

import { useState } from "react";
import { avatarUrl } from "@/lib/api";
import { initials, avatarColor } from "@/lib/format";

export function Avatar({
  chatId,
  title,
  hasPhoto,
  size = 48,
}: {
  chatId: string;
  title: string;
  hasPhoto: boolean;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const showImg = hasPhoto && !failed;

  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-full flex items-center justify-center font-medium text-white select-none"
      style={{
        width: size,
        height: size,
        backgroundColor: avatarColor(chatId),
        fontSize: size * 0.4,
      }}
      aria-hidden
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl(chatId)}
          alt={title}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span>{initials(title)}</span>
      )}
    </div>
  );
}
