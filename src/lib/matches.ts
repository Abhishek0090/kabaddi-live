import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import { PUBLIC_MATCH_COLUMNS, type MatchRow } from "./db.types";
import { isUuid } from "./ids";
import { createPublicClient } from "./supabase/server";

/** One match for the public pages. Deduped between generateMetadata and the page. */
export const getMatch = cache(async (id: string): Promise<MatchRow | null> => {
  await connection();
  if (!isUuid(id)) return null;
  const { data, error } = await createPublicClient()
    .from("matches")
    .select(PUBLIC_MATCH_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Could not load the match: ${error.message}`);
  return data;
});

export async function listMatches(): Promise<{ live: MatchRow[]; upcoming: MatchRow[]; finished: MatchRow[] }> {
  await connection();
  const { data, error } = await createPublicClient()
    .from("matches")
    .select(PUBLIC_MATCH_COLUMNS)
    .order("scheduled_at", { ascending: true, nullsFirst: false })
    .limit(300);
  if (error) throw new Error(`Could not load matches: ${error.message}`);
  const rows = data ?? [];
  return {
    live: rows.filter((m) => m.status === "live"),
    upcoming: rows.filter((m) => m.status === "scheduled"),
    finished: rows.filter((m) => m.status === "finished").reverse().slice(0, 30),
  };
}
