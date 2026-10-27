"use client";

import Link from "next/link";
import { ConnectionBadge } from "@/components/ConnectionBadge";
import { MatDots } from "@/components/MatDots";
import { teamText } from "@/components/ui";
import type { MatchRow } from "@/lib/db.types";
import { matchView, type Banner } from "@/lib/display";
import { formatClock, formatSeconds } from "@/lib/format";
import type { MatchState, Team } from "@/lib/kabaddi.types";
import { useLiveMatch } from "@/lib/useLiveMatch";
import { useNow } from "@/lib/useNow";
import { useServerClock } from "@/lib/useServerClock";

const bannerStyle: Record<Banner["kind"], string> = {
  timeout: "bg-amber-400 text-zinc-950",
  halftime: "bg-indigo-600 text-white",
  fulltime: "bg-emerald-600 text-white",
  paused: "bg-zinc-300 text-zinc-950 dark:bg-zinc-800 dark:text-white",
  pre: "bg-zinc-300 text-zinc-950 dark:bg-zinc-800 dark:text-white",
};

export function LiveScoreboard({ initial }: { initial: MatchRow }) {
  const { match, status } = useLiveMatch(initial);
  const now = useNow(250);
  useServerClock();

  const state = match.state;
  const view = matchView(state, now);
  const raider = view.raidMs !== null ? state.raidingTeam : null;

  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-zinc-50 text-zinc-950 dark:bg-black dark:text-white">
      <header className="flex items-center justify-between gap-2 px-4 py-2">
        <Link href="/" className="min-h-11 content-center text-sm font-semibold text-zinc-500 hover:underline">
          All matches
        </Link>
        <span className="text-sm font-black uppercase tracking-widest text-zinc-500">
          {state.half === 1 ? "1st half" : "2nd half"}
        </span>
        <ConnectionBadge status={status} />
      </header>

      {view.banner && (
        <div className={`px-4 py-[min(2vh,1rem)] text-center ${bannerStyle[view.banner.kind]}`} role="status">
          <p className="text-[clamp(1.5rem,6vw,4rem)] font-black leading-tight">
            {view.banner.title}
            {view.banner.kind === "timeout" && view.banner.detail && (
              <span className="ml-3 font-mono tabular-nums">{view.banner.detail}</span>
            )}
          </p>
          {view.banner.kind !== "timeout" && view.banner.detail && (
            <p className="text-[clamp(1rem,4vw,2.5rem)] font-bold">{view.banner.detail}</p>
          )}
        </div>
      )}

      <section className="grid flex-1 grid-cols-2 content-center gap-x-2 gap-y-4 px-2 py-4 sm:px-6 lg:grid-cols-[1fr_auto_1fr]">
        <TeamColumn team="A" state={state} raiding={raider === "A"} className="order-1" />

        <div className="order-3 col-span-2 flex flex-col items-center justify-center gap-2 lg:order-2 lg:col-span-1">
          <span
            className="font-mono font-black leading-none tabular-nums text-[min(20vw,16vh)] lg:text-[min(11vw,18vh)]"
            aria-label="Match clock"
          >
            {formatClock(view.matchMs)}
          </span>
          {raider && view.raidMs !== null && (
            <div className="flex flex-wrap items-center justify-center gap-3">
              <span className={`text-[clamp(1.25rem,5vw,3rem)] font-black ${teamText[raider]}`}>
                {state.teams[raider].name} raid
              </span>
              <span className="rounded-xl bg-zinc-950 px-3 font-mono text-[clamp(2rem,10vw,6rem)] font-black leading-tight text-white tabular-nums dark:bg-white dark:text-zinc-950">
                {formatSeconds(view.raidMs)}
              </span>
            </div>
          )}
          {!raider && state.raidingTeam && view.phase === "play" && (
            <span className={`text-[clamp(1rem,4vw,2rem)] font-bold ${teamText[state.raidingTeam]}`}>
              Next raid: {state.teams[state.raidingTeam].name}
            </span>
          )}
          {view.doOrDie && (
            <span className="animate-pulse rounded-lg bg-red-600 px-4 py-1 text-[clamp(1rem,4vw,2.25rem)] font-black uppercase text-white">
              Do or die
            </span>
          )}
        </div>

        <TeamColumn team="B" state={state} raiding={raider === "B"} className="order-2 lg:order-3" />
      </section>

      <section className="mx-auto w-full max-w-3xl px-4 pb-6">
        <h2 className="text-xs font-black uppercase tracking-widest text-zinc-500">Last events</h2>
        <ol className="mt-1 divide-y divide-zinc-200 dark:divide-zinc-800">
          {state.feed.slice(0, 5).map((item) => (
            <li key={`${item.at}-${item.text}`} className={`py-1.5 text-lg font-semibold ${item.team ? teamText[item.team] : ""}`}>
              {item.text}
            </li>
          ))}
          {state.feed.length === 0 && <li className="py-1.5 text-zinc-500">No events yet.</li>}
        </ol>
      </section>
    </main>
  );
}

function TeamColumn({
  team,
  state,
  raiding,
  className,
}: {
  team: Team;
  state: MatchState;
  raiding: boolean;
  className: string;
}) {
  const t = state.teams[team];
  return (
    <div
      className={`flex min-w-0 flex-col items-center gap-[min(1.5vh,0.75rem)] rounded-3xl border-t-8 px-1 pt-3 ${
        team === "A" ? "border-orange-500" : "border-sky-500"
      } ${raiding ? "bg-zinc-200/70 dark:bg-zinc-900" : ""} ${className}`}
    >
      <h2 className={`w-full truncate text-center text-[clamp(1.25rem,6vw,4.5rem)] font-black leading-tight ${teamText[team]}`}>
        {t.name}
      </h2>
      <span className="font-black leading-[0.85] tabular-nums text-[min(30vw,36vh)] lg:text-[min(20vw,42vh)]">
        {t.score}
      </span>
      <MatDots team={team} onMat={t.mat.length} total={state.settings.playersOnMat} className="h-[min(4.5vw,4vh)] w-[min(4.5vw,4vh)]" />
      <span className="text-[clamp(0.85rem,2.5vw,1.25rem)] font-semibold text-zinc-500">
        {raiding ? "Raiding - " : ""}Timeouts left: {t.timeoutsLeft}
      </span>
    </div>
  );
}
