import { NextResponse } from "next/server";
import { mockGetMatch } from "@/lib/mock/store";
import { MOCK } from "@/lib/mode";

// Mock mode only: public pages poll this instead of Supabase Realtime.
export async function GET(_request: Request, ctx: RouteContext<"/api/mock/matches/[id]">) {
  const match = MOCK ? mockGetMatch((await ctx.params).id) : null;
  if (!match) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(match, { headers: { "Cache-Control": "no-store" } });
}
