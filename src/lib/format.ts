import type { MatchEvent, MatchState } from "./kabaddi.types";

/** mm:ss, rounding up so the display only shows 00:00 when time is really up. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatSeconds(ms: number): string {
  return String(Math.max(0, Math.ceil(ms / 1000)));
}

export function scoreLine(state: MatchState): string {
  const { A, B } = state.teams;
  return `${A.name} ${A.score} - ${B.score} ${B.name}`;
}

export function resultText(state: MatchState): string {
  const { A, B } = state.teams;
  if (A.score === B.score) return `Match tied ${A.score}-${B.score}`;
  const [winner, loser] = A.score > B.score ? [A, B] : [B, A];
  return `${winner.name} won ${winner.score}-${loser.score}`;
}

/** Short label for an event, used by Undo. */
export function eventLabel(event: MatchEvent, state: MatchState): string {
  const team = (t: "A" | "B") => state.teams[t].name;
  switch (event.type) {
    case "TOUCH":
      return `Touch ${event.n}`;
    case "TIMEOUT":
      return `Timeout ${team(event.team)}`;
    case "SET_RAIDING_TEAM":
      return `${team(event.team)} to raid`;
    default:
      return event.type
        .toLowerCase()
        .split("_")
        .map((w, i) => (i === 0 ? w[0].toUpperCase() + w.slice(1) : w))
        .join(" ");
  }
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "No date set";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}
