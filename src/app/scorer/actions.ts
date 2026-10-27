"use server";

import { redirect } from "next/navigation";
import { insertRoom } from "@/lib/adminData";
import { requireAdmin } from "@/lib/auth";
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

  const { userId } = await requireAdmin("/scorer");
  const result = await insertRoom({
    teamA: teamA.name,
    teamB: teamB.name,
    scheduledAt: scheduled.toISOString(),
    settings: settings.settings,
    userId,
  });
  if ("error" in result) return { error: `Could not create the room: ${result.error}` };

  redirect(`/scorer/${result.id}`);
}
