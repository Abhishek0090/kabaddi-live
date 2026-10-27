import type { Clock } from "./kabaddi.types";

export function remainingMs(clock: Clock, now: number): number {
  if (clock.runningSince === null) return clock.remainingMs;
  return Math.max(0, clock.remainingMs - (now - clock.runningSince));
}

export function isRunning(clock: Clock): boolean {
  return clock.runningSince !== null;
}

export function startClock(clock: Clock, now: number): Clock {
  if (clock.runningSince !== null) return clock;
  return { runningSince: now, remainingMs: clock.remainingMs };
}

export function pauseClock(clock: Clock, now: number): Clock {
  if (clock.runningSince === null) return clock;
  return { runningSince: null, remainingMs: remainingMs(clock, now) };
}
