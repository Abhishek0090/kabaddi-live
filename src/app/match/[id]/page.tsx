import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { scoreLine } from "@/lib/format";
import { getMatch } from "@/lib/matches";
import { LiveScoreboard } from "./LiveScoreboard";

const statusText = { live: "Live now", scheduled: "Upcoming match", finished: "Final score" } as const;

export async function generateMetadata({ params }: PageProps<"/match/[id]">): Promise<Metadata> {
  const match = await getMatch((await params).id);
  if (!match) return { title: "Match not found" };
  const title = scoreLine(match.state);
  const description = `${statusText[match.status]}: ${match.team_a} vs ${match.team_b}. Kabaddi live score.`;
  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function MatchPage({ params }: PageProps<"/match/[id]">) {
  const match = await getMatch((await params).id);
  if (!match) notFound();
  return <LiveScoreboard initial={match} />;
}
