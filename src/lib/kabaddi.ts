import { isRunning, pauseClock, remainingMs, startClock } from "./clock";
import type {
  ApplyResult,
  FeedItem,
  MatchEvent,
  MatchState,
  Settings,
  Team,
  TeamState,
} from "./kabaddi.types";

export const DEFAULT_SETTINGS: Settings = {
  playersOnMat: 7,
  halfMs: 20 * 60_000,
  raidMs: 30_000,
  timeoutsPerHalf: 2,
  timeoutMs: 30_000,
  allOutBonus: 2,
};

export const FEED_LIMIT = 20;
const BONUS_MIN_DEFENDERS = 6;
const SUPER_TACKLE_MAX_DEFENDERS = 3;
const DO_OR_DIE_AFTER = 2;

const SCORING_EVENTS = new Set<MatchEvent["type"]>([
  "TOUCH",
  "BONUS",
  "EMPTY_RAID",
  "TACKLE",
  "RAID_TIMEOUT",
]);

export function other(team: Team): Team {
  return team === "A" ? "B" : "A";
}

function fullMat(players: number): number[] {
  return Array.from({ length: players }, (_, i) => i + 1);
}

export function createInitialState(
  teamA: string,
  teamB: string,
  settings: Settings = DEFAULT_SETTINGS,
): MatchState {
  const team = (name: string): TeamState => ({
    name,
    score: 0,
    mat: fullMat(settings.playersOnMat),
    outQueue: [],
    timeoutsLeft: settings.timeoutsPerHalf,
    emptyRaids: 0,
  });
  return {
    settings: { ...settings },
    teams: { A: team(teamA), B: team(teamB) },
    half: 1,
    phase: "pre",
    matchClock: { runningSince: null, remainingMs: settings.halfMs },
    raid: null,
    raidingTeam: null,
    firstRaider: null,
    timeout: null,
    feed: [],
  };
}

/** True while a do-or-die raid is running, or when the next raid will be one. */
export function isDoOrDie(state: MatchState): boolean {
  if (state.raid) return state.raid.doOrDie;
  return (
    state.raidingTeam !== null &&
    state.teams[state.raidingTeam].emptyRaids >= DO_OR_DIE_AFTER
  );
}

class Rejected extends Error {}

function reject(message: string): never {
  throw new Rejected(message);
}

/** Pure: returns a new state, or the reason the event is not allowed. */
export function applyEvent(state: MatchState, event: MatchEvent): ApplyResult {
  const next = structuredClone(state);
  try {
    apply(next, event);
  } catch (e) {
    if (e instanceof Rejected) return { ok: false, error: e.message };
    throw e;
  }
  return { ok: true, state: next };
}

/** Rebuilds state from an event log. Used for undo (replay without the last event). */
export function replay(
  initial: MatchState,
  events: readonly MatchEvent[],
): ApplyResult {
  let state = initial;
  for (const [i, event] of events.entries()) {
    const result = applyEvent(state, event);
    if (!result.ok) {
      return { ok: false, error: `Event ${i + 1} (${event.type}): ${result.error}` };
    }
    state = result.state;
  }
  return { ok: true, state };
}

// Everything below mutates `s`, which is always a private clone.

function apply(s: MatchState, e: MatchEvent): void {
  const { at } = e;

  // A timeout that has run out is over, even if RESUME has not arrived yet.
  if (s.timeout && e.type !== "RESUME" && at >= s.timeout.endsAt) {
    s.timeout = null;
  }

  if (SCORING_EVENTS.has(e.type)) {
    if (s.phase === "halftime") reject("It's half time. Scoring is closed.");
    if (s.phase === "fulltime") reject("The match is over.");
    if (s.timeout) reject("Timeout in progress.");
    if (!s.raid) reject("Start the raid first.");
  }

  switch (e.type) {
    case "SET_RAIDING_TEAM":
      if (s.phase === "halftime" || s.phase === "fulltime") {
        reject("Can't change the raiding team during a break.");
      }
      if (s.raid) reject("A raid is in progress.");
      s.raidingTeam = e.team;
      return;

    case "START_CLOCK":
      assertNotBreak(s, "Can't start the clock");
      if (s.timeout) reject("Timeout in progress.");
      if (isRunning(s.matchClock)) reject("The clock is already running.");
      if (remainingMs(s.matchClock, at) <= 0) reject("No time left in this half.");
      s.phase = "play";
      s.matchClock = startClock(s.matchClock, at);
      if (s.raid) s.raid.clock = startClock(s.raid.clock, at);
      return;

    case "PAUSE_CLOCK":
      if (s.phase !== "play") reject("The match is not in play.");
      if (!isRunning(s.matchClock)) reject("The clock is already paused.");
      pauseAll(s, at);
      return;

    case "START_RAID": {
      assertNotBreak(s, "Can't start a raid");
      if (s.timeout) reject("Timeout in progress.");
      if (s.raid) reject("A raid is already in progress.");
      const raider = s.raidingTeam ?? reject("Pick the raiding team first.");
      if (remainingMs(s.matchClock, at) <= 0) reject("No time left in this half.");
      s.phase = "play";
      s.matchClock = startClock(s.matchClock, at);
      s.raid = {
        clock: { runningSince: at, remainingMs: s.settings.raidMs },
        doOrDie: s.teams[raider].emptyRaids >= DO_OR_DIE_AFTER,
        bonus: false,
      };
      if (s.half === 1 && s.firstRaider === null) s.firstRaider = raider;
      return;
    }

    case "STOP_RAID":
      if (!s.raid) reject("No raid in progress.");
      s.raid = null;
      return;

    case "TOUCH": {
      const raider = raidingTeam(s);
      const defender = other(raider);
      const n = e.n;
      const defenders = s.teams[defender].mat.length;
      if (!Number.isInteger(n) || n < 1) reject("Touch points must be 1 or more.");
      if (n > defenders) reject(`Only ${defenders} defenders are on the mat.`);
      s.teams[raider].score += n;
      sendOut(s.teams[defender], n);
      revive(s.teams[raider], n, s.settings.playersOnMat);
      feed(s, at, e.type, raider, `${s.teams[raider].name} touch ${n} (+${n})`);
      endRaid(s, false);
      checkAllOut(s, at);
      return;
    }

    case "BONUS": {
      const raider = raidingTeam(s);
      const defenders = s.teams[other(raider)].mat.length;
      if (s.raid?.bonus) reject("Bonus already given in this raid.");
      if (defenders < BONUS_MIN_DEFENDERS) {
        reject(`Bonus needs ${BONUS_MIN_DEFENDERS} or more defenders. ${defenders} on the mat.`);
      }
      s.teams[raider].score += 1;
      s.raid!.bonus = true;
      feed(s, at, e.type, raider, `${s.teams[raider].name} bonus (+1)`);
      return;
    }

    case "EMPTY_RAID": {
      const raider = raidingTeam(s);
      const raid = s.raid!;
      if (raid.bonus) {
        // The raid already scored a bonus, so it is not empty.
        endRaid(s, false);
      } else if (raid.doOrDie) {
        raiderOut(s, at, e.type, 1, "do-or-die raid failed");
        endRaid(s, false);
        checkAllOut(s, at);
      } else {
        feed(s, at, e.type, raider, `${s.teams[raider].name} empty raid`);
        endRaid(s, true);
      }
      return;
    }

    case "TACKLE": {
      const defenders = s.teams[other(raidingTeam(s))].mat.length;
      const isSuper = defenders <= SUPER_TACKLE_MAX_DEFENDERS;
      raiderOut(s, at, e.type, isSuper ? 2 : 1, isSuper ? "super tackle" : "tackle");
      endRaid(s, false);
      checkAllOut(s, at);
      return;
    }

    case "RAID_TIMEOUT":
      raiderOut(s, at, e.type, 1, "raid time ran out");
      endRaid(s, false);
      checkAllOut(s, at);
      return;

    case "TIMEOUT": {
      if (s.phase !== "play") reject("Timeouts are only allowed during play.");
      if (s.timeout) reject("A timeout is already in progress.");
      const team = s.teams[e.team];
      if (team.timeoutsLeft <= 0) reject(`${team.name} has no timeouts left.`);
      pauseAll(s, at);
      team.timeoutsLeft -= 1;
      s.timeout = { team: e.team, endsAt: at + s.settings.timeoutMs };
      feed(s, at, e.type, e.team, `${team.name} timeout`);
      return;
    }

    case "RESUME":
      if (!s.timeout) reject("No timeout in progress.");
      // Clocks stay paused: play restarts on Start clock or Start raid.
      s.timeout = null;
      return;

    case "END_HALF": {
      if (s.phase !== "play") reject("The half is not in play.");
      s.matchClock = pauseClock(s.matchClock, at);
      s.raid = null;
      s.timeout = null;
      const { A, B } = s.teams;
      const score = `${A.name} ${A.score} - ${B.score} ${B.name}`;
      if (s.half === 1) {
        s.phase = "halftime";
        feed(s, at, e.type, null, `Half time: ${score}`);
      } else {
        s.phase = "fulltime";
        feed(s, at, e.type, null, `Full time: ${score}`);
      }
      return;
    }

    case "START_SECOND_HALF":
      if (s.phase !== "halftime") reject("The second half starts after half time.");
      s.half = 2;
      s.phase = "play";
      s.matchClock = { runningSince: null, remainingMs: s.settings.halfMs };
      s.teams.A.timeoutsLeft = s.settings.timeoutsPerHalf;
      s.teams.B.timeoutsLeft = s.settings.timeoutsPerHalf;
      if (s.firstRaider) s.raidingTeam = other(s.firstRaider);
      feed(s, at, e.type, null, "Second half");
      return;
  }
}

function assertNotBreak(s: MatchState, action: string): void {
  if (s.phase === "halftime") reject(`${action} at half time. Start the 2nd half first.`);
  if (s.phase === "fulltime") reject(`${action}. The match is over.`);
}

function raidingTeam(s: MatchState): Team {
  return s.raidingTeam ?? reject("Pick the raiding team first.");
}

function pauseAll(s: MatchState, at: number): void {
  s.matchClock = pauseClock(s.matchClock, at);
  if (s.raid) s.raid.clock = pauseClock(s.raid.clock, at);
}

function sendOut(team: TeamState, n: number): void {
  const out = team.mat.splice(team.mat.length - n, n);
  team.outQueue.push(...out.reverse());
}

function revive(team: TeamState, n: number, playersOnMat: number): void {
  const count = Math.min(n, team.outQueue.length, playersOnMat - team.mat.length);
  team.mat.push(...team.outQueue.splice(0, count));
  team.mat.sort((a, b) => a - b);
}

/** Raider is out: defending team scores and revives one player. */
function raiderOut(
  s: MatchState,
  at: number,
  type: MatchEvent["type"],
  points: number,
  reason: string,
): void {
  const raider = raidingTeam(s);
  const defender = other(raider);
  sendOut(s.teams[raider], 1);
  s.teams[defender].score += points;
  revive(s.teams[defender], 1, s.settings.playersOnMat);
  feed(s, at, type, defender, `${s.teams[defender].name} +${points}, ${reason}`);
}

function endRaid(s: MatchState, empty: boolean): void {
  const raider = raidingTeam(s);
  s.teams[raider].emptyRaids = empty ? s.teams[raider].emptyRaids + 1 : 0;
  s.raid = null;
  s.raidingTeam = other(raider);
}

function checkAllOut(s: MatchState, at: number): void {
  for (const team of ["A", "B"] as const) {
    const t = s.teams[team];
    if (t.mat.length > 0) continue;
    const scorer = other(team);
    s.teams[scorer].score += s.settings.allOutBonus;
    t.mat = fullMat(s.settings.playersOnMat);
    t.outQueue = [];
    feed(
      s,
      at,
      "ALL_OUT",
      scorer,
      `All out! ${s.teams[scorer].name} +${s.settings.allOutBonus}`,
    );
  }
}

function feed(
  s: MatchState,
  at: number,
  type: FeedItem["type"],
  team: Team | null,
  text: string,
): void {
  s.feed.unshift({ at, type, team, text });
  if (s.feed.length > FEED_LIMIT) s.feed.length = FEED_LIMIT;
}
