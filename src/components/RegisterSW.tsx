"use client";

import { useEffect } from "react";

/** Registers the service worker in production builds only, so dev never serves stale pages. */
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // The app works without it; it just won't open offline.
    });
  }, []);
  return null;
}
