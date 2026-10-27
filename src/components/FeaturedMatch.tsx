"use client";

import Link from "next/link";
import type { MatchRow } from "@/lib/db.types";
import { matchView } from "@/lib/display";
import { formatClock, formatDateTime, formatSeconds, resultText } from "@/lib/format";
import type { Team } from "@/lib/kabaddi.types";
import { useLiveMatch } from "@/lib/useLiveMatch";
import { useNow } from "@/lib/useNow";
import { useServerClock } from "@/lib/useServerClock";
import { ConnectionBadge } from "./ConnectionBadge";

const nameColor = { A: "text-orange-400", B: "text-sky-400" } as const;
const dotColor = { A: "bg-orange-500", B: "bg-sky-500" } as const;

/** Live mini scoreboard for the hero. */
export function FeaturedMatch({ initial }: { initial: MatchRow }) {
  const { match, status } = useLiveMatch(initial);
  const now = useNow(250);
  useServerClock();

  const s = match.state;
  const view = matchView(s, now);
  const raider = view.raidMs !== null ? s.raidingTeam : null;
  const live = match.status === "live";

  const team = (t: Team) => (
    <div className="flex min-w-0 flex-col items-center gap-2">
      <span className={`w-full truncate text-center text-sm font-black uppercase tracking-wide sm:text-base ${nameColor[t]}`}>
        {s.teams[t].name}
      </span>
      <span className="text-6xl font-black leading-none tabular-nums text-white sm:text-7xl">{s.teams[t].score}</span>
      <span className="flex gap-1" aria-label={`${s.teams[t].mat.length} on the mat`}>
        {Array.from({ length: s.settings.playersOnMat }, (_, i) => (
          <span
            key={i}
            className={`h-2.5 w-2.5 rounded-full ${i < s.teams[t].mat.length ? dotColor[t] : "border border-white/30"}`}
          />
        ))}
      </span>
    </div>
  );

  return (
    <Link
      href={`/match/${match.id}`}
      className="group block rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/50 backdrop-blur-md transition hover:border-white/20 sm:p-6"
    >
      <div className="flex items-center justify-between gap-2 text-xs font-bold uppercase tracking-widest text-zinc-400">
        {live ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-white">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            Live
          </span>
        ) : (
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-zinc-200">
            {match.status === "finished" ? "Final" : "Next up"}
          </span>
        )}
        <span>{live ? (s.half === 1 ? "1st half" : "2nd half") : formatDateTime(match.scheduled_at)}</span>
        {live && <ConnectionBadge status={status} className="text-[11px] normal-case tracking-normal text-zinc-300" />}
      </div>

      <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        {team("A")}
        <div className="flex flex-col items-center gap-1">
          {live ? (
            <span className="font-mono text-2xl font-black tabular-nums text-white sm:text-3xl">{formatClock(view.matchMs)}</span>
          ) : (
            <span className="text-lg font-black text-zinc-500">vs</span>
          )}
        </div>
        {team("B")}
      </div>

      <div className="mt-5 flex min-h-10 flex-wrap items-center justify-center gap-2 text-sm font-bold">
        {live && raider && view.raidMs !== null && (
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-zinc-950">
            <span className={raider === "A" ? "text-orange-600" : "text-sky-600"}>{s.teams[raider].name} raiding</span>
            <span className="font-mono tabular-nums">{formatSeconds(view.raidMs)}s</span>
          </span>
        )}
        {live && view.doOrDie && (
          <span className="animate-pulse rounded-full bg-red-600 px-3 py-1.5 uppercase text-white">Do or die</span>
        )}
        {live && view.banner && (
          <span className="rounded-full bg-amber-400 px-3 py-1.5 text-zinc-950">
            {view.banner.title}
            {view.banner.kind === "timeout" && view.banner.detail ? ` ${view.banner.detail}` : ""}
          </span>
        )}
        {match.status === "finished" && <span className="text-zinc-300">{resultText(s)}</span>}
      </div>

      {live && s.feed.length > 0 && (
        <ol className="mt-4 space-y-1 border-t border-white/10 pt-4 text-sm">
          {s.feed.slice(0, 3).map((item, i) => (
            <li
              key={`${item.at}-${item.text}`}
              className={`truncate ${i === 0 ? "font-bold text-white" : "text-zinc-400"}`}
            >
              {item.text}
            </li>
          ))}
        </ol>
      )}

      <p className="mt-4 text-center text-sm font-bold text-orange-400 group-hover:underline">Open full scoreboard</p>
    </Link>
  );
}
