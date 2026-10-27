import { describe, expect, it } from "vitest";
import { eventToRow, rowToEvent } from "@/lib/events";
import { formatClock, resultText } from "@/lib/format";
import { DEFAULT_SETTINGS, createInitialState } from "@/lib/kabaddi";
import type { MatchEvent } from "@/lib/kabaddi.types";
import { parseSettings, parseTeamName } from "@/lib/settings";

describe("event rows", () => {
  const events: MatchEvent[] = [
    { type: "START_RAID", at: 1 },
    { type: "TOUCH", n: 3, at: 2 },
    { type: "TIMEOUT", team: "B", at: 3 },
    { type: "SET_RAIDING_TEAM", team: "A", at: 4 },
  ];

  it("round-trip through type + payload", () => {
    for (const event of events) expect(rowToEvent(eventToRow(event))).toEqual(event);
  });

  it("reject unknown types", () => {
    expect(() => rowToEvent({ type: "DROP_TABLE", payload: { at: 1 } })).toThrow();
  });
});

describe("parseSettings", () => {
  it("keeps defaults for empty fields", () => {
    expect(parseSettings({ halfMinutes: "", raidSeconds: undefined })).toEqual({ ok: true, settings: DEFAULT_SETTINGS });
  });

  it("converts form units to ms", () => {
    const result = parseSettings({ halfMinutes: "15", raidSeconds: "25", timeoutSeconds: "60" });
    expect(result).toEqual({
      ok: true,
      settings: { ...DEFAULT_SETTINGS, halfMs: 15 * 60_000, raidMs: 25_000, timeoutMs: 60_000 },
    });
  });

  it("rejects out-of-range and non-integer values", () => {
    expect(parseSettings({ playersOnMat: "9" })).toEqual({ ok: false, error: "Players on mat must be a whole number from 5 to 7." });
    expect(parseSettings({ halfMinutes: "2.5" }).ok).toBe(false);
  });
});

describe("parseTeamName", () => {
  it("trims and collapses spaces", () => {
    expect(parseTeamName("  Red   Bulls ", "Team A")).toEqual({ ok: true, name: "Red Bulls" });
  });

  it("requires a name", () => {
    expect(parseTeamName("   ", "Team A")).toEqual({ ok: false, error: "Team A name is required." });
  });
});

describe("format", () => {
  it("rounds the clock up to the next second", () => {
    expect(formatClock(20 * 60_000)).toBe("20:00");
    expect(formatClock(400)).toBe("00:01");
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(-5)).toBe("00:00");
  });

  it("describes the result", () => {
    const s = createInitialState("Tigers", "Lions");
    expect(resultText(s)).toBe("Match tied 0-0");
    s.teams.B.score = 31;
    s.teams.A.score = 28;
    expect(resultText(s)).toBe("Lions won 31-28");
  });
});
