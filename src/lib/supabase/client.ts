import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "../db.types";
import { supabaseEnv } from "./env";

/** Browser client. Singleton per tab, session kept in cookies. */
export function createClient() {
  const { url, key } = supabaseEnv();
  return createBrowserClient<Database>(url, key);
}
