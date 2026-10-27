import "server-only";
import type { ScorerMatchRow } from "./db.types";
import { rowToEvent } from "./events";
import { isUuid } from "./ids";
import { createInitialState } from "./kabaddi";
import type { MatchEvent, Settings } from "./kabaddi.types";
import { mockCreateRoom, mockRoom, mockRoomsFor } from "./mock/store";
import { MOCK } from "./mode";
import { createClient } from "./supabase/server";

// Data access for admin pages. Callers must have checked the user with requireAdmin.

const ROOM_COLUMNS = "id, team_a, team_b, scheduled_at, status, state, updated_at, settings, scorer_id, last_seq" as const;

export async function listMyRooms(userId: string): Promise<ScorerMatchRow[]> {
  if (MOCK) return mockRoomsFor(userId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("matches")
    .select(ROOM_COLUMNS)
    .eq("scorer_id", userId)
    .order("scheduled_at", { ascending: false });
  if (error) throw new Error(`Could not load your rooms: ${error.message}`);
  return data ?? [];
}

/** The room and its event log, or null when it doesn't exist or isn't this admin's. */
export async function getRoom(id: string, userId: string): Promise<{ match: ScorerMatchRow; events: MatchEvent[] } | null> {
  if (MOCK) return mockRoom(id, userId);
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data: match } = await supabase.from("matches").select(ROOM_COLUMNS).eq("id", id).maybeSingle();
  if (!match || match.scorer_id !== userId) return null;

  const { data: rows, error } = await supabase
    .from("match_events")
    .select("seq, type, payload")
    .eq("match_id", id)
    .order("seq")
    .range(0, 4999);
  if (error) throw new Error(`Could not load the event log: ${error.message}`);
  return { match, events: (rows ?? []).map(rowToEvent) };
}

export async function insertRoom(input: {
  teamA: string;
  teamB: string;
  scheduledAt: string;
  settings: Settings;
  userId: string;
}): Promise<{ id: string } | { error: string }> {
  if (MOCK) return { id: mockCreateRoom(input) };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("matches")
    .insert({
      team_a: input.teamA,
      team_b: input.teamB,
      scheduled_at: input.scheduledAt,
      settings: input.settings,
      state: createInitialState(input.teamA, input.teamB, input.settings),
      scorer_id: input.userId,
    })
    .select("id")
    .single();
  return error ? { error: error.message } : { id: data.id };
}
