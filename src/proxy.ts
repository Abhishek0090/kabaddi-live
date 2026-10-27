import { NextResponse, type NextRequest } from "next/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  // Not configured yet: let the pages render their own setup message.
  if (!hasSupabaseEnv()) return NextResponse.next();
  const { response, userId } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  let target: URL | null = null;
  if (!userId && pathname.startsWith("/scorer")) {
    target = new URL("/login", request.url);
    target.searchParams.set("next", pathname + search);
  } else if (userId && (pathname === "/login" || pathname === "/register")) {
    target = new URL("/scorer", request.url);
  }
  if (!target) return response;

  // Keep any refreshed auth cookies on the redirect.
  const redirect = NextResponse.redirect(target);
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}

export const config = {
  matcher: ["/scorer/:path*", "/login", "/register"],
};
