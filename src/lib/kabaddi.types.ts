export type Team = "A" | "B";

export type Phase = "pre" | "play" | "halftime" | "fulltime";

export interface Settings {
  playersOnMat: number;
  halfMs: number;
  raidMs: number;
  timeoutsPerHalf: number;
  timeoutMs: number;
  allOutBonus: number;
}

/** A clock is never stored ticking: clients derive the display from these two values. */
export interface Clock {
  /** Server-time epoch ms when the clock last started, or null when paused. */
  runningSince: number | null;
  /** Time left at `runningSince` (or now, when paused). */
  remainingMs: number;
}

export interface TeamState {
  name: string;
  score: number;
  /** Anonymous slot numbers (1..playersOnMat) currently on the mat. */
  mat: number[];
  /** Slots that are out, oldest first. Revival takes from the front. */
  outQueue: number[];
  timeoutsLeft: number;
  /** Consecutive empty raids. 2 or more makes the team's next raid do-or-die. */
  emptyRaids: number;
}

export interface Raid {
  clock: Clock;
  doOrDie: boolean;
  bonus: boolean;
}

export interface Timeout {
  team: Team;
  endsAt: number;
}

export type SimpleEventType =
  | "START_CLOCK"
  | "PAUSE_CLOCK"
  | "START_RAID"
  | "STOP_RAID"
  | "BONUS"
  | "EMPTY_RAID"
  | "TACKLE"
  | "RAID_TIMEOUT"
  | "RESUME"
  | "END_HALF"
  | "START_SECOND_HALF";

/** `at` is the server-adjusted epoch ms of the tap, so replaying a log is exact. */
export type MatchEvent =
  | { type: SimpleEventType; at: number }
  | { type: "TOUCH"; n: number; at: number }
  | { type: "TIMEOUT" | "SET_RAIDING_TEAM"; team: Team; at: number };

export type EventType = MatchEvent["type"];

export interface FeedItem {
  at: number;
  type: EventType | "ALL_OUT";
  team: Team | null;
  text: string;
}

export interface MatchState {
  settings: Settings;
  teams: Record<Team, TeamState>;
  half: 1 | 2;
  phase: Phase;
  matchClock: Clock;
  raid: Raid | null;
  raidingTeam: Team | null;
  /** Team that made the first raid of half 1. The other team raids first in half 2. */
  firstRaider: Team | null;
  timeout: Timeout | null;
  /** Newest first, capped at FEED_LIMIT. The full log lives in match_events. */
  feed: FeedItem[];
}

export type ApplyResult =
  | { ok: true; state: MatchState }
  | { ok: false; error: string };
