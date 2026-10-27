import { describe, expect, it } from "vitest";
import { createInitialState, replay } from "@/lib/kabaddi";
import { MatchSimulator } from "@/lib/mock/simulate";

describe("MatchSimulator (mock mode)", () => {
  const start = 1_700_000_000_000;

  it("plays a full match to full time with only valid events", () => {
    const initial = createInitialState("Kings", "Ninjas");
    const { state, events } = new MatchSimulator(42, start).advance(initial, start + 3 * 60 * 60_000);
    expect(state.phase).toBe("fulltime");
    expect(state.teams.A.score + state.teams.B.score).toBeGreaterThan(20);
    expect(replay(initial, events)).toEqual({ ok: true, state });
    // Timestamps never go backwards.
    expect(events.every((e, i) => i === 0 || e.at >= events[i - 1].at)).toBe(true);
  });

  it("is deterministic for a seed and can advance in steps", () => {
    const initial = createInitialState("Kings", "Ninjas");
    const whole = new MatchSimulator(7, start).advance(initial, start + 10 * 60_000);

    const sim = new MatchSimulator(7, start);
    let s = initial;
    for (let t = start; t <= start + 10 * 60_000; t += 1000) s = sim.advance(s, t).state;
    expect(s).toEqual(whole.state);
  });

  it("does nothing before its start time", () => {
    const initial = createInitialState("Kings", "Ninjas");
    expect(new MatchSimulator(1, start).advance(initial, start - 1).events).toEqual([]);
  });
});
