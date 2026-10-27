import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import { PUBLIC_MATCH_COLUMNS, type MatchRow } from "./db.types";
import { isUuid } from "./ids";
import { mockGetMatch, mockListMatches } from "./mock/store";
import { MOCK } from "./mode";
import { hasSupabaseEnv } from "./supabase/env";
import { createPublicClient } from "./supabase/server";

export type MatchLists = { live: MatchRow[]; upcoming: MatchRow[]; finished: MatchRow[] };

/** One match for the public pages. Deduped between generateMetadata and the page. */
export const getMatch = cache(async (id: string): Promise<MatchRow | null> => {
  await connection();
  if (MOCK) return mockGetMatch(id);
  if (!isUuid(id)) return null;
  const { data, error } = await createPublicClient()
    .from("matches")
    .select(PUBLIC_MATCH_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Could not load the match: ${error.message}`);
  return data;
});

/** All matches grouped for the home page, or null when no data source is configured. */
export async function listMatches(): Promise<MatchLists | null> {
  await connection();
  let rows: MatchRow[];
  if (MOCK) {
    rows = mockListMatches();
  } else if (!hasSupabaseEnv()) {
    return null;
  } else {
    const { data, error } = await createPublicClient()
      .from("matches")
      .select(PUBLIC_MATCH_COLUMNS)
      .order("scheduled_at", { ascending: true, nullsFirst: false })
      .limit(300);
    if (error) throw new Error(`Could not load matches: ${error.message}`);
    rows = data ?? [];
  }
  return {
    live: rows.filter((m) => m.status === "live"),
    upcoming: rows.filter((m) => m.status === "scheduled"),
    finished: rows.filter((m) => m.status === "finished").reverse().slice(0, 30),
  };
}
