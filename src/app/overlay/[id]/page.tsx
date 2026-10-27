import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMatch } from "@/lib/matches";
import { Overlay } from "./Overlay";

export const metadata: Metadata = { title: "Overlay", robots: { index: false } };

export default async function OverlayPage({ params }: PageProps<"/overlay/[id]">) {
  const match = await getMatch((await params).id);
  if (!match) notFound();
  return <Overlay initial={match} />;
}
