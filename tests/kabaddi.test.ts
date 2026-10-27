import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  FEED_LIMIT,
  applyEvent,
  createInitialState,
  isDoOrDie,
  replay,
} from "@/lib/kabaddi";
import type {
  MatchEvent,
  MatchState,
  SimpleEventType,
  Team,
} from "@/lib/kabaddi.types";

const T0 = 1_700_000_000_000;
let now = T0;
let log: MatchEvent[] = [];

beforeEach(() => {
  now = T0;
  log = [];
});

function tick(ms = 1000): number {
  now += ms;
  return now;
}

const ev = (type: SimpleEventType, ms?: number): MatchEvent => ({ type, at: tick(ms) });
const touch = (n: number): MatchEvent => ({ type: "TOUCH", n, at: tick() });
const timeout = (team: Team): MatchEvent => ({ type: "TIMEOUT", team, at: tick() });
const setRaider = (team: Team): MatchEvent => ({ type: "SET_RAIDING_TEAM", team, at: tick() });

function ok(state: MatchState, event: MatchEvent): MatchState {
  const result = applyEvent(state, event);
  if (!result.ok) throw new Error(`${event.type} rejected: ${result.error}`);
  log.push(event);
  return result.state;
}

function run(state: MatchState, ...events: MatchEvent[]): MatchState {
  return events.reduce(ok, state);
}

function rejected(state: MatchState, event: MatchEvent): string {
  const result = applyEvent(state, event);
  if (result.ok) throw new Error(`${event.type} was accepted`);
  return result.error;
}

/** One complete raid: start it, then apply the outcome. */
function raid(state: MatchState, ...outcome: MatchEvent[]): MatchState {
  return run(state, ev("START_RAID"), ...outcome);
}

function newMatch(): MatchState {
  return createInitialState("Tigers", "Lions");
}

/** Match with team A picked to raid first. */
function started(): MatchState {
  return run(newMatch(), setRaider("A"));
}

describe("initial state", () => {
  it("uses the default settings", () => {
    const s = newMatch();
    expect(s.settings).toEqual(DEFAULT_SETTINGS);
    expect(s.phase).toBe("pre");
    expect(s.half).toBe(1);
    expect(s.teams.A.mat).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(s.teams.B.timeoutsLeft).toBe(2);
    expect(s.matchClock).toEqual({ runningSince: null, remainingMs: 20 * 60_000 });
  });

  it("does not mutate the input state", () => {
    const s = started();
    const before = structuredClone(s);
    applyEvent(s, ev("START_RAID"));
    applyEvent(s, touch(2));
    expect(s).toEqual(before);
  });
});

describe("raids and clocks", () => {
  it("rejects a raid before a raiding team is picked", () => {
    expect(rejected(newMatch(), ev("START_RAID"))).toMatch(/raiding team/);
  });

  it("START_RAID starts the raid clock and the paused match clock", () => {
    const s = run(started(), ev("START_RAID"));
    expect(s.phase).toBe("play");
    expect(s.matchClock.runningSince).toBe(now);
    expect(s.raid?.clock).toEqual({ runningSince: now, remainingMs: 30_000 });
  });

  it("PAUSE_CLOCK pauses both clocks and START_CLOCK resumes both", () => {
    let s = run(started(), ev("START_RAID"), ev("PAUSE_CLOCK", 10_000));
    expect(s.matchClock).toEqual({ runningSince: null, remainingMs: 20 * 60_000 - 10_000 });
    expect(s.raid?.clock).toEqual({ runningSince: null, remainingMs: 20_000 });
    s = run(s, ev("START_CLOCK", 5_000));
    expect(s.matchClock.runningSince).toBe(now);
    expect(s.raid?.clock.runningSince).toBe(now);
  });

  it("STOP_RAID cancels the raid with no points and the same team raids again", () => {
    const s = run(started(), ev("START_RAID"), ev("STOP_RAID"));
    expect(s.raid).toBeNull();
    expect(s.raidingTeam).toBe("A");
    expect(s.teams.A.score + s.teams.B.score).toBe(0);
  });

  it("rejects raid outcomes when no raid is running", () => {
    expect(rejected(started(), touch(1))).toMatch(/Start the raid/);
  });
});

describe("TOUCH", () => {
  it("scores n, sends n defenders out, ends the raid and switches team", () => {
    const s = raid(started(), touch(2));
    expect(s.teams.A.score).toBe(2);
    expect(s.teams.B.mat).toHaveLength(5);
    expect(s.teams.B.outQueue).toHaveLength(2);
    expect(s.raid).toBeNull();
    expect(s.raidingTeam).toBe("B");
  });

  it("revives the raiding team's out players in the order they went out", () => {
    let s = raid(started(), ev("TACKLE")); // A's raider out first
    const firstOut = s.teams.A.outQueue[0];
    s = raid(s, touch(1)); // B touches one more A defender
    expect(s.teams.A.outQueue).toHaveLength(2);
    const secondOut = s.teams.A.outQueue[1];

    s = raid(s, touch(1)); // A revives one
    expect(s.teams.A.outQueue).toEqual([secondOut]);
    expect(s.teams.A.mat).toContain(firstOut);
    expect(s.teams.A.mat).toHaveLength(6);
  });

  it("revives no more players than are out", () => {
    const s = raid(started(), touch(3));
    expect(s.teams.A.mat).toHaveLength(7);
    expect(s.teams.A.outQueue).toEqual([]);
  });

  it("rejects more touches than defenders on the mat", () => {
    let s = raid(started(), touch(5)); // B down to 2
    s = raid(s, ev("EMPTY_RAID"));
    s = run(s, ev("START_RAID"));
    expect(rejected(s, touch(3))).toMatch(/Only 2 defenders/);
  });
});

describe("BONUS", () => {
  it("is allowed with 7 defenders and does not end the raid", () => {
    const s = run(started(), ev("START_RAID"), ev("BONUS"));
    expect(s.teams.A.score).toBe(1);
    expect(s.raid).not.toBeNull();
    expect(s.raidingTeam).toBe("A");
  });

  it("is allowed with 6 defenders", () => {
    let s = raid(started(), touch(1)); // B 6
    s = raid(s, ev("EMPTY_RAID"));
    s = run(s, ev("START_RAID"), ev("BONUS"));
    expect(s.teams.A.score).toBe(2);
  });

  it("is rejected with 5 defenders", () => {
    let s = raid(started(), touch(2)); // B 5
    s = raid(s, ev("EMPTY_RAID"));
    s = run(s, ev("START_RAID"));
    expect(rejected(s, ev("BONUS"))).toMatch(/6 or more defenders\. 5 on the mat/);
  });

  it("is allowed only once per raid", () => {
    const s = run(started(), ev("START_RAID"), ev("BONUS"));
    expect(rejected(s, ev("BONUS"))).toMatch(/already/);
  });

  it("can be followed by a touch", () => {
    const s = run(started(), ev("START_RAID"), ev("BONUS"), touch(1));
    expect(s.teams.A.score).toBe(2);
    expect(s.raidingTeam).toBe("B");
  });

  it("followed by EMPTY_RAID does not count as an empty raid", () => {
    const s = run(started(), ev("START_RAID"), ev("BONUS"), ev("EMPTY_RAID"));
    expect(s.teams.A.emptyRaids).toBe(0);
    expect(s.teams.A.score).toBe(1);
    expect(s.raidingTeam).toBe("B");
  });
});

describe("TACKLE", () => {
  it("gives +1 with 4 or more defenders, puts the raider out and revives one defender", () => {
    let s = raid(started(), touch(1)); // B 6
    s = raid(s, ev("TACKLE")); // A tackles B's raider: A +1
    expect(s.teams.A.score).toBe(2);
    expect(s.teams.B.mat).toHaveLength(5);
    expect(s.teams.A.mat).toHaveLength(7);
    expect(s.raidingTeam).toBe("A");
  });

  it("does not give a super tackle with exactly 4 defenders", () => {
    let s = raid(started(), touch(3)); // B 4
    s = raid(s, ev("EMPTY_RAID"));
    s = raid(s, ev("TACKLE"));
    expect(s.teams.B.score).toBe(1);
  });

  it("gives +2 as a super tackle with 3 or fewer defenders", () => {
    let s = raid(started(), touch(4)); // B 3
    s = raid(s, ev("EMPTY_RAID"));
    s = raid(s, ev("TACKLE"));
    expect(s.teams.B.score).toBe(2);
    expect(s.teams.B.mat).toHaveLength(4); // revived one
    expect(s.teams.A.mat).toHaveLength(6);
    expect(s.feed[0].text).toMatch(/super tackle/);
  });
});

describe("ALL OUT", () => {
  it("happens on a touch that clears the mat", () => {
    let s = raid(started(), touch(4)); // A 4, B 3
    s = raid(s, ev("EMPTY_RAID"));
    s = raid(s, touch(3)); // B 0
    expect(s.teams.A.score).toBe(4 + 3 + 2);
    expect(s.teams.B.mat).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(s.teams.B.outQueue).toEqual([]);
    expect(s.feed[0].type).toBe("ALL_OUT");
  });

  it("happens when the last raider is tackled", () => {
    let s = raid(started(), touch(6)); // B 1
    s = raid(s, ev("TACKLE")); // B's last man tackled by A (7 defenders, so +1)
    expect(s.teams.A.score).toBe(6 + 1 + 2);
    expect(s.teams.B.mat).toHaveLength(7);
    expect(s.feed[0].text).toBe("All out! Tigers +2");
  });

  it("uses the allOutBonus setting", () => {
    const base = createInitialState("Tigers", "Lions", { ...DEFAULT_SETTINGS, allOutBonus: 3 });
    let s = run(base, setRaider("A"));
    s = raid(s, touch(6));
    s = raid(s, ev("EMPTY_RAID"));
    s = raid(s, touch(1));
    expect(s.teams.A.score).toBe(6 + 1 + 3);
  });
});

describe("do-or-die", () => {
  function twoEmptyEach(): MatchState {
    let s = started();
    for (let i = 0; i < 4; i++) s = raid(s, ev("EMPTY_RAID"));
    return s;
  }

  it("marks the third raid after two empty raids", () => {
    let s = started();
    s = raid(s, ev("EMPTY_RAID"));
    s = raid(s, ev("EMPTY_RAID"));
    expect(s.raidingTeam).toBe("A");
    expect(isDoOrDie(s)).toBe(false);

    s = raid(s, ev("EMPTY_RAID"));
    s = raid(s, ev("EMPTY_RAID"));
    expect(s.teams.A.emptyRaids).toBe(2);
    expect(isDoOrDie(s)).toBe(true);
    s = run(s, ev("START_RAID"));
    expect(s.raid?.doOrDie).toBe(true);
  });

  it("puts the raider out on an empty do-or-die raid and gives the defenders +1", () => {
    const s = raid(twoEmptyEach(), ev("EMPTY_RAID"));
    expect(s.teams.B.score).toBe(1);
    expect(s.teams.A.mat).toHaveLength(6);
    expect(s.teams.A.emptyRaids).toBe(0);
    expect(s.raidingTeam).toBe("B");
    expect(s.feed[0].text).toMatch(/do-or-die/);
  });

  it("resets the count when the raid scores", () => {
    const s = raid(twoEmptyEach(), touch(1));
    expect(s.teams.A.emptyRaids).toBe(0);
    expect(s.teams.A.score).toBe(1);
  });

  it("resets the count when the raider is tackled", () => {
    let s = started();
    s = raid(s, ev("EMPTY_RAID")); // A 1
    s = raid(s, ev("EMPTY_RAID")); // B 1
    s = raid(s, ev("TACKLE")); // A raider tackled
    expect(s.teams.A.emptyRaids).toBe(0);
  });

  it("has no penalty when the raid already scored a bonus", () => {
    const s = run(twoEmptyEach(), ev("START_RAID"), ev("BONUS"), ev("EMPTY_RAID"));
    expect(s.teams.A.score).toBe(1);
    expect(s.teams.B.score).toBe(0);
    expect(s.teams.A.mat).toHaveLength(7);
  });
});

describe("RAID_TIMEOUT", () => {
  it("puts the raider out and gives the defenders +1", () => {
    let s = raid(started(), ev("EMPTY_RAID")); // A has 1 empty raid
    s = raid(s, ev("EMPTY_RAID"));
    s = run(s, ev("START_RAID"), ev("RAID_TIMEOUT", 30_000));
    expect(s.teams.B.score).toBe(1);
    expect(s.teams.A.mat).toHaveLength(6);
    expect(s.teams.A.emptyRaids).toBe(0);
    expect(s.raidingTeam).toBe("B");
  });
});

describe("timeouts", () => {
  it("are rejected before play starts", () => {
    expect(rejected(started(), timeout("A"))).toMatch(/only allowed during play/);
  });

  it("pause both clocks, use one timeout and block scoring", () => {
    const s = run(started(), ev("START_RAID"), timeout("B"));
    expect(s.matchClock.runningSince).toBeNull();
    expect(s.raid?.clock.runningSince).toBeNull();
    expect(s.teams.B.timeoutsLeft).toBe(1);
    expect(s.timeout).toEqual({ team: "B", endsAt: now + 30_000 });
    expect(rejected(s, touch(1))).toMatch(/Timeout in progress/);
    expect(rejected(s, ev("START_CLOCK"))).toMatch(/Timeout in progress/);
  });

  it("end on RESUME with the clocks still paused", () => {
    const s = run(started(), ev("START_CLOCK"), timeout("A"), ev("RESUME"));
    expect(s.timeout).toBeNull();
    expect(s.matchClock.runningSince).toBeNull();
  });

  it("end on their own once the time is up", () => {
    let s = run(started(), ev("START_CLOCK"), timeout("A"));
    s = run(s, ev("START_RAID", 30_000));
    expect(s.timeout).toBeNull();
    expect(s.raid).not.toBeNull();
  });

  it("are rejected when a team has none left", () => {
    const s = run(started(), ev("START_CLOCK"), timeout("A"), ev("RESUME"), timeout("A"), ev("RESUME"));
    expect(s.teams.A.timeoutsLeft).toBe(0);
    expect(rejected(s, timeout("A"))).toBe("Tigers has no timeouts left.");
    expect(applyEvent(s, timeout("B")).ok).toBe(true);
  });

  it("reset to 2 each for the second half", () => {
    let s = run(started(), ev("START_CLOCK"), timeout("A"), ev("RESUME"), timeout("A"), ev("RESUME"));
    s = run(s, ev("END_HALF"), ev("START_SECOND_HALF"));
    expect(s.teams.A.timeoutsLeft).toBe(2);
    expect(s.teams.B.timeoutsLeft).toBe(2);
  });
});

describe("halves", () => {
  it("END_HALF in half 1 stops clocks, cancels the raid and goes to halftime", () => {
    const s = run(started(), ev("START_RAID"), ev("END_HALF"));
    expect(s.phase).toBe("halftime");
    expect(s.raid).toBeNull();
    expect(s.matchClock.runningSince).toBeNull();
    expect(s.feed[0].text).toBe("Half time: Tigers 0 - 0 Lions");
  });

  it("an automatic END_HALF at the buzzer leaves 0 on the clock", () => {
    const s = run(started(), ev("START_CLOCK"), ev("END_HALF", 20 * 60_000));
    expect(s.matchClock.remainingMs).toBe(0);
  });

  it("blocks scoring and raids at half time", () => {
    const s = run(started(), ev("START_RAID"), ev("END_HALF"));
    expect(rejected(s, touch(1))).toMatch(/half time/);
    expect(rejected(s, ev("TACKLE"))).toMatch(/half time/);
    expect(rejected(s, ev("START_RAID"))).toMatch(/half time/);
    expect(rejected(s, ev("START_CLOCK"))).toMatch(/half time/);
  });

  it("START_SECOND_HALF resets the clock and the other team raids first", () => {
    let s = raid(started(), touch(1)); // A raided first
    s = raid(s, ev("EMPTY_RAID")); // B raids, so A is next
    s = run(s, ev("END_HALF"), ev("START_SECOND_HALF"));
    expect(s.half).toBe(2);
    expect(s.phase).toBe("play");
    expect(s.matchClock).toEqual({ runningSince: null, remainingMs: 20 * 60_000 });
    expect(s.raidingTeam).toBe("B");
  });

  it("START_SECOND_HALF is only allowed from half time", () => {
    expect(rejected(run(started(), ev("START_CLOCK")), ev("START_SECOND_HALF"))).toMatch(/after half time/);
  });

  it("blocks scoring at full time", () => {
    let s = run(started(), ev("START_CLOCK"), ev("END_HALF"), ev("START_SECOND_HALF"), ev("START_RAID"));
    s = run(s, ev("END_HALF"));
    expect(s.phase).toBe("fulltime");
    expect(rejected(s, touch(1))).toMatch(/match is over/);
    expect(rejected(s, ev("START_RAID"))).toMatch(/match is over/);
    expect(rejected(s, ev("START_SECOND_HALF"))).toMatch(/after half time/);
  });
});

describe("feed", () => {
  it(`keeps the newest ${FEED_LIMIT} items`, () => {
    let s = started();
    for (let i = 0; i < FEED_LIMIT + 5; i++) s = raid(s, ev("STOP_RAID"), ev("START_RAID"), ev("BONUS"), ev("EMPTY_RAID"));
    expect(s.feed).toHaveLength(FEED_LIMIT);
    expect(s.feed[0].at).toBeGreaterThan(s.feed[1].at);
  });
});

describe("replay", () => {
  it("rebuilds the same state from the event log", () => {
    const initial = newMatch();
    let s = run(initial, setRaider("A"));
    s = raid(s, ev("BONUS"), touch(2));
    s = raid(s, ev("TACKLE"));
    s = run(s, timeout("A"), ev("RESUME"));
    s = raid(s, touch(1));
    s = raid(s, ev("EMPTY_RAID"));
    s = raid(s, ev("RAID_TIMEOUT", 30_000));
    s = run(s, ev("END_HALF"), ev("START_SECOND_HALF"));
    s = raid(s, touch(3));

    const result = replay(initial, log);
    expect(result).toEqual({ ok: true, state: s });
  });

  it("without the last event gives the state before it (undo)", () => {
    const initial = newMatch();
    let s = run(initial, setRaider("A"));
    s = raid(s, touch(2));
    s = run(s, ev("START_RAID"));
    const beforeLast = s;
    s = run(s, ev("TACKLE"));

    const result = replay(initial, log.slice(0, -1));
    expect(result).toEqual({ ok: true, state: beforeLast });
  });

  it("reports which event is invalid", () => {
    const result = replay(newMatch(), [ev("START_RAID")]);
    expect(result).toEqual({ ok: false, error: "Event 1 (START_RAID): Pick the raiding team first." });
  });
});
