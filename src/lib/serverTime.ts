import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./db.types";

const STORAGE_KEY = "kabaddi:clock-offset";

// Server time minus this device's time, in ms. Kept across reloads so an
// offline scorer still stamps events with corrected time.
let offset = readStoredOffset();

function readStoredOffset(): number {
  try {
    const n = Number(globalThis.localStorage?.getItem(STORAGE_KEY));
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

/** Current server time in epoch ms. */
export function serverNow(): number {
  return Date.now() + offset;
}

/** Measures the offset a few times and keeps the sample with the shortest round trip. */
export async function syncServerTime(supabase: SupabaseClient<Database>, samples = 3): Promise<void> {
  let best: { rtt: number; offset: number } | null = null;
  for (let i = 0; i < samples; i++) {
    const t0 = Date.now();
    const { data, error } = await supabase.rpc("server_now");
    const t1 = Date.now();
    if (error || typeof data !== "number") return;
    const rtt = t1 - t0;
    const sample = data + rtt / 2 - t1;
    if (!best || rtt < best.rtt) best = { rtt, offset: sample };
  }
  if (!best) return;
  offset = Math.round(best.offset);
  try {
    localStorage.setItem(STORAGE_KEY, String(offset));
  } catch {
    // Not persisted; the offset still applies for this session.
  }
}
