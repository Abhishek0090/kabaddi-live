import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRoom } from "@/lib/adminData";
import { requireAdmin } from "@/lib/auth";
import { ControlPanel } from "./ControlPanel";

export const metadata: Metadata = { title: "Control panel", robots: { index: false } };

export default async function ControlPanelPage({ params }: PageProps<"/scorer/[id]">) {
  const { id } = await params;
  const { userId } = await requireAdmin(`/scorer/${id}`);
  // Only the room's own admin may open its control panel.
  const room = await getRoom(id, userId);
  if (!room) notFound();
  return <ControlPanel match={room.match} events={room.events} />;
}
