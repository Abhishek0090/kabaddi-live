import { NextResponse, type NextRequest } from "next/server";
import { MOCK, MOCK_SESSION_COOKIE } from "@/lib/mode";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { updateSession } from "@/lib/supabase/proxy";

function toLogin(request: NextRequest): NextResponse {
  const target = new URL("/login", request.url);
  target.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(target);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (MOCK) {
    // The pages check the user against the mock store; this only skips a round trip.
    const signedIn = request.cookies.has(MOCK_SESSION_COOKIE);
    return !signedIn && pathname.startsWith("/scorer") ? toLogin(request) : NextResponse.next();
  }

  // Not configured yet: let the pages render their own setup message.
  if (!hasSupabaseEnv()) return NextResponse.next();

  const { response, userId } = await updateSession(request);
  let redirect: NextResponse | null = null;
  if (!userId && pathname.startsWith("/scorer")) redirect = toLogin(request);
  else if (userId && (pathname === "/login" || pathname === "/register")) {
    redirect = NextResponse.redirect(new URL("/scorer", request.url));
  }
  if (!redirect) return response;

  // Keep any refreshed auth cookies on the redirect.
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}

export const config = {
  matcher: ["/scorer/:path*", "/login", "/register"],
};
