"use client";

import type { MatchRow } from "@/lib/db.types";
import { matchView } from "@/lib/display";
import { formatClock, formatSeconds } from "@/lib/format";
import type { Team } from "@/lib/kabaddi.types";
import { useLiveMatch } from "@/lib/useLiveMatch";
import { useNow } from "@/lib/useNow";
import { useServerClock } from "@/lib/useServerClock";

const teamBlock = { A: "bg-orange-600", B: "bg-sky-600" } as const;

/**
 * Lower-third scorebug for an OBS Browser Source at 1920x1080. Sizes are in px
 * because OBS renders at a fixed canvas; it sits inside the 5% title-safe area.
 */
export function Overlay({ initial }: { initial: MatchRow }) {
  const { match, status } = useLiveMatch(initial);
  const now = useNow(250);
  useServerClock();

  const state = match.state;
  const view = matchView(state, now);
  const raider = view.raidMs !== null ? state.raidingTeam : null;

  return (
    <>
      {/* OBS composites this page over the video, so nothing may paint a background. */}
      <style>{`html, body { background: transparent !important; color-scheme: normal; }`}</style>
      <div className="pointer-events-none fixed bottom-[54px] left-[96px] flex flex-col items-start gap-2 font-sans text-white">
        <div className="flex items-stretch overflow-hidden rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
          <TeamBlock team="A" name={state.teams.A.name} score={state.teams.A.score} onMat={state.teams.A.mat.length}
            total={state.settings.playersOnMat} raiding={raider === "A"} />
          <div className="flex min-w-[190px] flex-col items-center justify-center bg-zinc-950/95 px-5 py-2">
            <span className="font-mono text-[44px] font-black leading-none tabular-nums">{formatClock(view.matchMs)}</span>
            <span className="text-[16px] font-bold uppercase tracking-[0.2em] text-zinc-400">
              {state.half === 1 ? "1st half" : "2nd half"}
            </span>
          </div>
          <TeamBlock team="B" name={state.teams.B.name} score={state.teams.B.score} onMat={state.teams.B.mat.length}
            total={state.settings.playersOnMat} raiding={raider === "B"} />
        </div>

        <div className="flex items-center gap-2 text-[20px] font-black">
          {raider && view.raidMs !== null && (
            <span className="rounded-lg bg-white px-3 py-1 text-zinc-950">
              {state.teams[raider].name} raid <span className="font-mono tabular-nums">{formatSeconds(view.raidMs)}s</span>
            </span>
          )}
          {view.doOrDie && <span className="rounded-lg bg-red-600 px-3 py-1 uppercase">Do or die</span>}
          {view.banner && view.banner.kind !== "pre" && (
            <span className="rounded-lg bg-amber-400 px-3 py-1 text-zinc-950">
              {view.banner.title}
              {view.banner.detail && ` ${view.banner.detail}`}
            </span>
          )}
          {status !== "live" && (
            <span className="rounded-lg bg-zinc-800/90 px-3 py-1 text-[16px] text-amber-300">
              {status === "connecting" ? "Connecting..." : "Reconnecting..."}
            </span>
          )}
        </div>
      </div>
    </>
  );
}

function TeamBlock(props: { team: Team; name: string; score: number; onMat: number; total: number; raiding: boolean }) {
  return (
    <div className={`flex items-center gap-4 px-5 py-2 ${teamBlock[props.team]} ${props.raiding ? "brightness-110" : ""}`}>
      {props.team === "B" && <Score score={props.score} />}
      <div className={`flex flex-col ${props.team === "A" ? "items-end" : "items-start"}`}>
        <span className="max-w-[300px] truncate text-[28px] font-black leading-tight">
          {props.raiding && props.team === "B" && "> "}
          {props.name}
          {props.raiding && props.team === "A" && " <"}
        </span>
        <span className="flex gap-1">
          {Array.from({ length: props.total }, (_, i) => (
            <span key={i} className={`h-[12px] w-[12px] rounded-full ${i < props.onMat ? "bg-white" : "border-2 border-white/60"}`} />
          ))}
        </span>
      </div>
      {props.team === "A" && <Score score={props.score} />}
    </div>
  );
}

function Score({ score }: { score: number }) {
  return <span className="min-w-[72px] text-center text-[60px] font-black leading-none tabular-nums">{score}</span>;
}
