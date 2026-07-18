"use client";

import { useCallback, useState } from "react";

/**
 * Download a URL with visible progress and save it to disk.
 * progress: null = idle, -1 = preparing (server still fetching from Telegram),
 * 0..100 = percentage of the streamed response received.
 */
export function useDownload() {
  const [progress, setProgress] = useState<number | null>(null);

  const start = useCallback(async (url: string, filename: string) => {
    setProgress(-1);
    try {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok || !res.body) {
        setProgress(null);
        return;
      }
      const total = Number(res.headers.get("content-length")) || 0;
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          received += value.length;
          if (total) setProgress(Math.round((received / total) * 100));
        }
      }
      const blob = new Blob(chunks as BlobPart[]);
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
    } catch {
      /* ignore */
    } finally {
      setProgress(null);
    }
  }, []);

  return { progress, start };
}
