import { describe, expect, it } from "vitest";
import { dueAutoEvent, matchView } from "@/lib/display";
import { applyEvent, createInitialState } from "@/lib/kabaddi";
import type { MatchEvent, MatchState } from "@/lib/kabaddi.types";

const HALF = 20 * 60_000;

function run(...events: MatchEvent[]): MatchState {
  let s = createInitialState("Tigers", "Lions");
  for (const e of events) {
    const r = applyEvent(s, e);
    if (!r.ok) throw new Error(r.error);
    s = r.state;
  }
  return s;
}

describe("matchView", () => {
  it("shows 'not started' before play", () => {
    expect(matchView(run(), 0).banner).toEqual({ kind: "pre", title: "Match not started" });
  });

  it("counts both clocks down from server time", () => {
    const s = run({ type: "SET_RAIDING_TEAM", team: "A", at: 0 }, { type: "START_RAID", at: 1000 });
    const v = matchView(s, 11_000);
    expect(v.matchMs).toBe(HALF - 10_000);
    expect(v.raidMs).toBe(20_000);
    expect(v.banner).toBeNull();
  });

  it("shows stored values before the first tick", () => {
    const s = run({ type: "START_CLOCK", at: 1000 });
    expect(matchView(s, null).matchMs).toBe(HALF);
  });

  it("shows 'Clock paused' when paused during play", () => {
    const s = run({ type: "START_CLOCK", at: 0 }, { type: "PAUSE_CLOCK", at: 5000 });
    expect(matchView(s, 9000).banner?.kind).toBe("paused");
  });

  it("shows the timeout countdown", () => {
    const s = run({ type: "START_CLOCK", at: 0 }, { type: "TIMEOUT", team: "B", at: 1000 });
    expect(matchView(s, 11_000).banner).toEqual({ kind: "timeout", title: "Timeout: Lions", detail: "20s", team: "B" });
  });

  it("shows half time as soon as the clock hits 0, before END_HALF arrives", () => {
    const s = run({ type: "START_CLOCK", at: 0 });
    const v = matchView(s, HALF + 50);
    expect(v.phase).toBe("halftime");
    expect(v.banner).toEqual({ kind: "halftime", title: "Half time", detail: "Tigers 0 - 0 Lions" });
  });

  it("shows the result at full time", () => {
    const s = run(
      { type: "START_CLOCK", at: 0 },
      { type: "END_HALF", at: 1 },
      { type: "START_SECOND_HALF", at: 2 },
      { type: "START_CLOCK", at: 3 },
      { type: "END_HALF", at: 4 },
    );
    expect(matchView(s, 10).banner).toEqual({ kind: "fulltime", title: "Full time", detail: "Match tied 0-0" });
  });
});

describe("dueAutoEvent", () => {
  it("is null while clocks have time left", () => {
    const s = run({ type: "SET_RAIDING_TEAM", team: "A", at: 0 }, { type: "START_RAID", at: 0 });
    expect(dueAutoEvent(s, 29_999)).toBeNull();
  });

  it("sends RAID_TIMEOUT stamped at the raid clock's expiry", () => {
    const s = run({ type: "SET_RAIDING_TEAM", team: "A", at: 0 }, { type: "START_RAID", at: 1000 });
    expect(dueAutoEvent(s, 40_000)).toEqual({ type: "RAID_TIMEOUT", at: 31_000 });
  });

  it("sends END_HALF stamped at the match clock's expiry", () => {
    const s = run({ type: "START_CLOCK", at: 1000 });
    expect(dueAutoEvent(s, HALF + 5000)).toEqual({ type: "END_HALF", at: HALF + 1000 });
  });

  it("prefers END_HALF when the half ends during a raid", () => {
    let s = run({ type: "SET_RAIDING_TEAM", team: "A", at: 0 }, { type: "START_CLOCK", at: 0 });
    const r = applyEvent(s, { type: "START_RAID", at: HALF - 10_000 });
    if (!r.ok) throw new Error(r.error);
    s = r.state;
    expect(dueAutoEvent(s, HALF + 30_000)).toEqual({ type: "END_HALF", at: HALF });
  });

  it("ends a timeout with RESUME at its end time", () => {
    const s = run({ type: "START_CLOCK", at: 0 }, { type: "TIMEOUT", team: "A", at: 1000 });
    expect(dueAutoEvent(s, 20_000)).toBeNull();
    expect(dueAutoEvent(s, 40_000)).toEqual({ type: "RESUME", at: 31_000 });
  });

  it("does nothing outside play", () => {
    const s = run({ type: "START_CLOCK", at: 0 }, { type: "END_HALF", at: 1 });
    expect(dueAutoEvent(s, HALF * 3)).toBeNull();
  });
});
