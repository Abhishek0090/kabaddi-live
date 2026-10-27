import { isRunning, remainingMs } from "./clock";
import { resultText, scoreLine } from "./format";
import { isDoOrDie } from "./kabaddi";
import type { Clock, MatchEvent, MatchState, Phase, Team } from "./kabaddi.types";

export type BannerKind = "timeout" | "halftime" | "fulltime" | "paused" | "pre";

export type Banner = { kind: BannerKind; title: string; detail?: string; team?: Team };

export type MatchView = {
  phase: Phase;
  matchMs: number;
  raidMs: number | null;
  timeoutMs: number;
  doOrDie: boolean;
  banner: Banner | null;
};

/**
 * What every screen shows at time `now` (server-adjusted ms). `now` is null
 * before the first client tick, which shows the stored clock values.
 */
export function matchView(state: MatchState, now: number | null): MatchView {
  const left = (c: Clock) => (now === null ? c.remainingMs : remainingMs(c, now));
  const matchMs = left(state.matchClock);
  const timeoutMs = state.timeout && now !== null ? Math.max(0, state.timeout.endsAt - now) : 0;
  const timeoutActive = state.timeout !== null && (now === null || timeoutMs > 0);

  // Display only: the half is over once the clock hits 0, even before the scorer's END_HALF arrives.
  const expired = state.phase === "play" && isRunning(state.matchClock) && matchMs === 0;
  const phase: Phase = expired ? (state.half === 1 ? "halftime" : "fulltime") : state.phase;

  let banner: Banner | null = null;
  if (phase === "fulltime") banner = { kind: "fulltime", title: "Full time", detail: resultText(state) };
  else if (phase === "halftime") banner = { kind: "halftime", title: "Half time", detail: scoreLine(state) };
  else if (timeoutActive && state.timeout) {
    banner = {
      kind: "timeout",
      title: `Timeout: ${state.teams[state.timeout.team].name}`,
      detail: now === null ? undefined : `${Math.ceil(timeoutMs / 1000)}s`,
      team: state.timeout.team,
    };
  } else if (phase === "pre") banner = { kind: "pre", title: "Match not started" };
  else if (!isRunning(state.matchClock)) banner = { kind: "paused", title: "Clock paused" };

  return {
    phase,
    matchMs,
    raidMs: state.raid && phase === "play" ? left(state.raid.clock) : null,
    timeoutMs,
    doOrDie: phase !== "halftime" && phase !== "fulltime" && isDoOrDie(state),
    banner,
  };
}

/**
 * The event the scorer's device must send because a clock ran out, stamped
 * with the exact expiry time. Returns null when nothing is due.
 */
export function dueAutoEvent(state: MatchState, now: number): MatchEvent | null {
  if (state.phase !== "play") return null;
  if (state.timeout) {
    return now >= state.timeout.endsAt ? { type: "RESUME", at: state.timeout.endsAt } : null;
  }

  const expiry = (c: Clock) => (c.runningSince === null ? null : c.runningSince + c.remainingMs);
  const halfEnd = expiry(state.matchClock);
  const raidEnd = state.raid ? expiry(state.raid.clock) : null;

  // END_HALF wins a tie: it cancels the raid anyway.
  if (halfEnd !== null && now >= halfEnd && (raidEnd === null || halfEnd <= raidEnd)) {
    return { type: "END_HALF", at: halfEnd };
  }
  if (raidEnd !== null && now >= raidEnd) return { type: "RAID_TIMEOUT", at: raidEnd };
  return null;
}
