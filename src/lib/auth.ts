import "server-only";
import { redirect } from "next/navigation";
import { mockSessionUser } from "./mock/session";
import { MOCK } from "./mode";
import { createClient } from "./supabase/server";

/** For admin pages: returns the signed-in admin, or redirects to /login. */
export async function requireAdmin(next: string): Promise<{ userId: string; email: string }> {
  const login = `/login?next=${encodeURIComponent(next)}`;
  if (MOCK) {
    const user = await mockSessionUser();
    if (!user) redirect(login);
    return { userId: user.id, email: user.email };
  }
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) redirect(login);
  return { userId: claims.sub, email: typeof claims.email === "string" ? claims.email : "" };
}
