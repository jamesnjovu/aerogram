"use client";

import { useState } from "react";
import { selfAvatarUrl } from "@/lib/api";
import { initials, avatarColor } from "@/lib/format";

export function SelfAvatar({
  id,
  name,
  size = 48,
  version,
  tryPhoto = true,
}: {
  id: string;
  name: string;
  size?: number;
  version?: number;
  tryPhoto?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const show = tryPhoto && !failed;

  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-full flex items-center justify-center font-medium text-white select-none"
      style={{
        width: size,
        height: size,
        backgroundColor: avatarColor(id || name),
        fontSize: size * 0.4,
      }}
    >
      {show ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={selfAvatarUrl(version)}
          alt={name}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span>{initials(name)}</span>
      )}
    </div>
  );
}
