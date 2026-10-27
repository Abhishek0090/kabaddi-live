import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Landing page for the email confirmation link (PKCE code exchange). */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/scorer";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/scorer";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(safeNext, origin));
  }

  const login = new URL("/login", origin);
  login.searchParams.set("error", "That link has expired or was already used. Log in, or register again.");
  return NextResponse.redirect(login);
}
