import Link from "next/link";
import type { MatchRow } from "@/lib/db.types";
import { formatDateTime, resultText } from "@/lib/format";
import { StatusBadge } from "./StatusBadge";

export function MatchCard({ match }: { match: MatchRow }) {
  const { A, B } = match.state.teams;
  const finished = match.status === "finished";
  const scheduled = match.status === "scheduled";
  const lead = A.score === B.score ? null : A.score > B.score ? "A" : "B";

  const row = (team: "A" | "B", name: string, score: number) => (
    <div className="flex items-center gap-3">
      <span className={`h-8 w-1.5 shrink-0 rounded-full ${team === "A" ? "bg-orange-500" : "bg-sky-500"}`} />
      <span className={`flex-1 truncate text-lg ${finished && lead !== team ? "font-semibold text-zinc-500" : "font-black"}`}>
        {name}
      </span>
      {!scheduled && (
        <span className={`text-3xl font-black tabular-nums ${finished && lead !== team ? "text-zinc-400" : ""}`}>{score}</span>
      )}
    </div>
  );

  return (
    <Link
      href={`/match/${match.id}`}
      className="group flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
    >
      <div className="flex items-center justify-between gap-2">
        <StatusBadge status={match.status} />
        <span className="text-xs font-semibold text-zinc-500">{formatDateTime(match.scheduled_at)}</span>
      </div>
      {row("A", match.team_a, A.score)}
      {row("B", match.team_b, B.score)}
      <div className="flex items-center justify-between border-t border-zinc-100 pt-2 text-sm dark:border-zinc-800">
        <span className="font-semibold text-zinc-500">
          {finished
            ? resultText(match.state)
            : scheduled
              ? "Not started"
              : `${match.state.half === 1 ? "1st" : "2nd"} half${match.state.phase === "halftime" ? " (break)" : ""}`}
        </span>
        <span className="font-bold text-orange-600 group-hover:underline dark:text-orange-400">
          {match.status === "live" ? "Watch live" : "Open"}
        </span>
      </div>
    </Link>
  );
}
