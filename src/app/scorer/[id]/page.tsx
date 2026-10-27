import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { rowToEvent } from "@/lib/events";
import { isUuid } from "@/lib/ids";
import { ControlPanel } from "./ControlPanel";

export const metadata: Metadata = { title: "Control panel", robots: { index: false } };

export default async function ControlPanelPage({ params }: PageProps<"/scorer/[id]">) {
  const { id } = await params;
  const { supabase, userId } = await requireAdmin(`/scorer/${id}`);
  if (!isUuid(id)) notFound();

  const { data: match } = await supabase
    .from("matches")
    .select("id, team_a, team_b, scheduled_at, status, state, updated_at, settings, scorer_id, last_seq")
    .eq("id", id)
    .maybeSingle();
  // Only the room's own admin may open its control panel.
  if (!match || match.scorer_id !== userId) notFound();

  const { data: rows, error } = await supabase
    .from("match_events")
    .select("seq, type, payload")
    .eq("match_id", id)
    .order("seq")
    .range(0, 4999);
  if (error) throw new Error(`Could not load the event log: ${error.message}`);

  return <ControlPanel match={match} events={(rows ?? []).map(rowToEvent)} />;
}
