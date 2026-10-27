import type { Json } from "./db.types";
import type { MatchEvent, Team } from "./kabaddi.types";

const EVENT_TYPES = new Set<MatchEvent["type"]>([
  "START_CLOCK",
  "PAUSE_CLOCK",
  "START_RAID",
  "STOP_RAID",
  "BONUS",
  "EMPTY_RAID",
  "TACKLE",
  "RAID_TIMEOUT",
  "RESUME",
  "END_HALF",
  "START_SECOND_HALF",
  "TOUCH",
  "TIMEOUT",
  "SET_RAIDING_TEAM",
]);

/** match_events stores `type` in its own column and the rest of the event as `payload`. */
export function eventToRow(event: MatchEvent): { type: string; payload: Json } {
  const { type, ...payload } = event;
  return { type, payload };
}

export function rowToEvent(row: { type: string; payload: Json }): MatchEvent {
  const p = (row.payload ?? {}) as Record<string, Json | undefined>;
  if (!EVENT_TYPES.has(row.type as MatchEvent["type"]) || typeof p.at !== "number") {
    throw new Error(`Bad event row: ${row.type}`);
  }
  const at = p.at;
  switch (row.type) {
    case "TOUCH":
      return { type: "TOUCH", n: Number(p.n), at };
    case "TIMEOUT":
    case "SET_RAIDING_TEAM":
      return { type: row.type, team: p.team === "B" ? "B" : ("A" as Team), at };
    default:
      return { type: row.type as Exclude<MatchEvent["type"], "TOUCH" | "TIMEOUT" | "SET_RAIDING_TEAM">, at };
  }
}
