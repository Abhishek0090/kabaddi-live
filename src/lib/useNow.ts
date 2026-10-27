"use client";

import { useEffect, useState } from "react";
import { serverNow } from "./serverTime";

/** Server-adjusted time, re-rendered every `intervalMs`. Null until the first tick (and on the server). */
export function useNow(intervalMs = 200): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(serverNow());
    const first = requestAnimationFrame(tick);
    const id = setInterval(tick, intervalMs);
    return () => {
      cancelAnimationFrame(first);
      clearInterval(id);
    };
  }, [intervalMs]);
  return now;
}
