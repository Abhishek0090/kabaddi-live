import { applyEvent, other } from "../kabaddi";
import type { MatchEvent, MatchState } from "../kabaddi.types";

/** Small seeded PRNG, so a demo match plays the same way every time. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HALFTIME_BREAK_MS = 60_000;

/**
 * Plays a believable match through the real rules engine, one raid at a
 * time. Mock mode only: it keeps the demo scoreboard moving.
 */
export class MatchSimulator {
  private readonly rng: () => number;
  private nextAt: number;

  constructor(seed: number, startAt: number) {
    this.rng = mulberry32(seed);
    this.nextAt = startAt;
  }

  /** Applies every simulated event due up to `now`. */
  advance(state: MatchState, now: number): { state: MatchState; events: MatchEvent[] } {
    let s = state;
    const events: MatchEvent[] = [];
    const push = (event: MatchEvent): boolean => {
      const result = applyEvent(s, event);
      if (!result.ok) return false;
      s = result.state;
      events.push(event);
      return true;
    };
    const between = (min: number, max: number) => min + Math.floor(this.rng() * (max - min));

    while (this.nextAt <= now && s.phase !== "fulltime") {
      const t = this.nextAt;
      const clock = s.matchClock;
      const halfEnd = clock.runningSince === null ? null : clock.runningSince + clock.remainingMs;

      if (halfEnd !== null && halfEnd <= t) {
        push({ type: "END_HALF", at: halfEnd });
        this.nextAt = halfEnd + HALFTIME_BREAK_MS;
      } else if (s.phase === "halftime") {
        push({ type: "START_SECOND_HALF", at: t });
        this.nextAt = t + 4000;
      } else if (s.raidingTeam === null) {
        push({ type: "SET_RAIDING_TEAM", team: this.rng() < 0.5 ? "A" : "B", at: t });
        this.nextAt = t + 3000;
      } else if (!s.raid) {
        const caller = other(s.raidingTeam);
        if (s.phase === "play" && this.rng() < 0.03 && s.teams[caller].timeoutsLeft > 0) {
          push({ type: "TIMEOUT", team: caller, at: t });
          this.nextAt = t + s.settings.timeoutMs + 2000;
        } else {
          push({ type: "START_RAID", at: t });
          this.nextAt = t + between(6000, 24_000);
        }
      } else {
        this.raidOutcome(s, push, t, between);
        this.nextAt = t + between(5000, 11_000);
      }
    }
    return { state: s, events };
  }

  private raidOutcome(
    s: MatchState,
    push: (e: MatchEvent) => boolean,
    t: number,
    between: (min: number, max: number) => number,
  ): void {
    const defenders = s.teams[other(s.raidingTeam!)].mat.length;
    const r = this.rng();
    if (r < 0.32) push({ type: "TOUCH", n: 1, at: t });
    else if (r < 0.44) push({ type: "TOUCH", n: Math.min(2, defenders), at: t });
    else if (r < 0.48) push({ type: "TOUCH", n: Math.min(between(3, 5), defenders), at: t });
    else if (r < 0.58) {
      const bonus = push({ type: "BONUS", at: t - 1500 });
      if (!bonus || this.rng() < 0.6) push({ type: "EMPTY_RAID", at: t });
      else push({ type: "TOUCH", n: 1, at: t });
    } else if (r < 0.78) push({ type: "EMPTY_RAID", at: t });
    else push({ type: "TACKLE", at: t });
  }
}
