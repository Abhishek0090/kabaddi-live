import { describe, expect, it } from "vitest";
import { isRunning, pauseClock, remainingMs, startClock } from "@/lib/clock";

describe("clock", () => {
  const paused = { runningSince: null, remainingMs: 60_000 };

  it("shows the stored time while paused", () => {
    expect(remainingMs(paused, 999_999)).toBe(60_000);
    expect(isRunning(paused)).toBe(false);
  });

  it("counts down from runningSince", () => {
    const running = startClock(paused, 1_000);
    expect(isRunning(running)).toBe(true);
    expect(remainingMs(running, 11_000)).toBe(50_000);
  });

  it("never goes below zero", () => {
    expect(remainingMs(startClock(paused, 0), 90_000)).toBe(0);
  });

  it("pause stores the time left at that moment", () => {
    expect(pauseClock(startClock(paused, 1_000), 21_000)).toEqual({ runningSince: null, remainingMs: 40_000 });
  });

  it("start and pause are no-ops when already in that state", () => {
    const running = startClock(paused, 1_000);
    expect(startClock(running, 5_000)).toBe(running);
    expect(pauseClock(paused, 5_000)).toBe(paused);
  });
});
