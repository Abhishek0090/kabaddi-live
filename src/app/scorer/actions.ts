"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createInitialState } from "@/lib/kabaddi";
import { SETTING_FIELDS, parseSettings, parseTeamName } from "@/lib/settings";

export type CreateRoomState = { error?: string };

export async function createRoom(_prev: CreateRoomState, formData: FormData): Promise<CreateRoomState> {
  const teamA = parseTeamName(formData.get("teamA"), "Team A");
  if (!teamA.ok) return { error: teamA.error };
  const teamB = parseTeamName(formData.get("teamB"), "Team B");
  if (!teamB.ok) return { error: teamB.error };
  if (teamA.name.toLowerCase() === teamB.name.toLowerCase()) {
    return { error: "The two teams need different names." };
  }

  // The form sends the browser's local date/time converted to ISO, so time zones line up.
  const scheduledRaw = String(formData.get("scheduledAt") ?? "");
  const scheduled = new Date(scheduledRaw);
  if (!scheduledRaw || Number.isNaN(scheduled.getTime())) return { error: "Pick a date and time." };

  const values = Object.fromEntries(SETTING_FIELDS.map((f) => [f.name, formData.get(f.name)?.toString()]));
  const settings = parseSettings(values);
  if (!settings.ok) return { error: settings.error };

  const { supabase, userId } = await requireAdmin("/scorer");
  const { data, error } = await supabase
    .from("matches")
    .insert({
      team_a: teamA.name,
      team_b: teamB.name,
      scheduled_at: scheduled.toISOString(),
      settings: settings.settings,
      state: createInitialState(teamA.name, teamB.name, settings.settings),
      scorer_id: userId,
    })
    .select("id")
    .single();
  if (error) return { error: `Could not create the room: ${error.message}` };

  redirect(`/scorer/${data.id}`);
}
