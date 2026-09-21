"use client";

import { useEffect } from "react";

export const VIEWED_KEY_PREFIX = "enki:story-viewed:";

/**
 * Sends one view per story per browser session. The session key is written
 * before the request, so React's development double-effect and quick reloads
 * don't double count. When storage is unavailable (private mode, blocked
 * cookies) it still counts once per page load rather than never.
 */
export function StoryViewPing({ storyId }: { storyId: string }) {
  useEffect(() => {
    const key = `${VIEWED_KEY_PREFIX}${storyId}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
    } catch {
      // Storage unavailable: fall through and count this page load.
    }
    fetch("/api/story-view", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ storyId }),
      keepalive: true,
    }).catch(() => {
      // Telemetry only; never surface a failure to the reader.
    });
  }, [storyId]);

  return null;
}
