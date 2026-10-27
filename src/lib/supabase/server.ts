import "server-only";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "../db.types";
import { supabaseEnv } from "./env";

/** Server client that acts as the logged-in user (reads the auth cookies). */
export async function createClient() {
  // Read cookies first: it marks the page as per-request, so the build never prerenders it.
  const cookieStore = await cookies();
  const { url, key } = supabaseEnv();
  return createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components can't set cookies. The proxy refreshes the session instead.
        }
      },
    },
  });
}

/** Anonymous client for public pages. No cookies, so it doesn't tie a page to a user. */
export function createPublicClient() {
  const { url, key } = supabaseEnv();
  return createPlainClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
