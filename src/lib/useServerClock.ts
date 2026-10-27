"use client";

import { useEffect } from "react";
import { MOCK } from "./mode";
import { createClient } from "./supabase/client";
import { syncServerTime } from "./serverTime";

/** Keeps serverNow() corrected: on load, when back online, and when the tab is shown again. */
export function useServerClock(): void {
  useEffect(() => {
    if (MOCK) return; // mock data uses this device's clock
    const supabase = createClient();
    const sync = () => void syncServerTime(supabase);
    const onVisible = () => {
      if (document.visibilityState === "visible") sync();
    };
    sync();
    window.addEventListener("online", sync);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", sync);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
}
