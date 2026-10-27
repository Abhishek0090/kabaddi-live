import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";

/** For admin pages: returns the signed-in user, or redirects to /login. */
export async function requireAdmin(next: string) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) redirect(`/login?next=${encodeURIComponent(next)}`);
  return { supabase, userId: claims.sub, email: typeof claims.email === "string" ? claims.email : "" };
}
