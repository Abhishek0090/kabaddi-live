import { randomUUID } from "node:crypto";
import type { MatchRow, MatchStatus, ScorerMatchRow } from "../db.types";
import { DEFAULT_SETTINGS, createInitialState } from "../kabaddi";
import type { MatchEvent, MatchState, Settings } from "../kabaddi.types";
import { MatchSimulator } from "./simulate";

// In-memory stand-in for Supabase, used only when NEXT_PUBLIC_MOCK="true".
// It mirrors the SQL rules: owner-only writes, seq checks, idempotent retries.
// Passwords are kept in plain text because this is throwaway demo data.

export const DEMO_ADMIN = { email: "demo@kabaddi.app", password: "kabaddi123" } as const;

const DEMO_ADMIN_ID = "00000000-0000-4000-8000-0000000000a1";
const SYSTEM_ID = "00000000-0000-4000-8000-0000000000a0";
const RESET_AFTER_FULLTIME_MS = 2 * 60_000;

type MockUser = { id: string; email: string; password: string };

type MockMatch = ScorerMatchRow & {
  events: MatchEvent[];
  sim?: { seed: number; simulator: MatchSimulator };
};

type Store = { users: Map<string, MockUser>; matches: Map<string, MockMatch> };

export type MockWriteResult = "ok" | "duplicate" | { code: "KB404" | "KB409"; message: string };

function statusFor(state: MatchState): MatchStatus {
  if (state.phase === "pre") return "scheduled";
  if (state.phase === "fulltime") return "finished";
  return "live";
}

function newMatch(
  id: string,
  teamA: string,
  teamB: string,
  scheduledAt: number,
  scorerId: string,
  settings: Settings = DEFAULT_SETTINGS,
): MockMatch {
  const iso = new Date(scheduledAt).toISOString();
  return {
    id,
    team_a: teamA,
    team_b: teamB,
    scheduled_at: iso,
    status: "scheduled",
    state: createInitialState(teamA, teamB, settings),
    updated_at: new Date().toISOString(),
    settings,
    scorer_id: scorerId,
    last_seq: 0,
    events: [],
  };
}

/** Runs the simulator on a match up to `now` and records the new events. */
function simulate(match: MockMatch, now: number): void {
  if (!match.sim) return;
  const { state, events } = match.sim.simulator.advance(match.state, now);
  if (events.length) {
    match.state = state;
    match.events.push(...events);
    match.last_seq = match.events.length;
    match.status = statusFor(state);
    match.updated_at = new Date(now).toISOString();
  }
  // Loop the demo: a fresh match starts two minutes after full time.
  const lastAt = match.events.at(-1)?.at ?? now;
  if (match.state.phase === "fulltime" && now - lastAt > RESET_AFTER_FULLTIME_MS) {
    const seed = match.sim.seed + 1;
    Object.assign(match, {
      state: createInitialState(match.team_a, match.team_b, match.settings),
      events: [],
      last_seq: 0,
      status: "scheduled",
      scheduled_at: new Date(now).toISOString(),
      updated_at: new Date(now).toISOString(),
      sim: { seed, simulator: new MatchSimulator(seed, now) },
    });
  }
}

function seed(): Store {
  const now = Date.now();
  const min = 60_000;
  const users = new Map<string, MockUser>([
    [DEMO_ADMIN_ID, { id: DEMO_ADMIN_ID, email: DEMO_ADMIN.email, password: DEMO_ADMIN.password }],
  ]);
  const matches = new Map<string, MockMatch>();

  // Plays itself, already a few minutes in. Owned by nobody you can log in as.
  const live = newMatch("11111111-1111-4111-8111-111111111111", "Kolhapur Kings", "Nashik Ninjas", now - 5 * min, SYSTEM_ID, {
    ...DEFAULT_SETTINGS,
    halfMs: 8 * min,
  });
  live.sim = { seed: 7, simulator: new MatchSimulator(7, now - 5 * min) };
  simulate(live, now);

  // A finished match, played start to end by the simulator.
  const finished = newMatch("33333333-3333-4333-8333-333333333333", "Hyderabad Hawks", "Kolkata Comets", now - 26 * 60 * min, DEMO_ADMIN_ID);
  const done = new MatchSimulator(42, now - 26 * 60 * min).advance(finished.state, now - 24 * 60 * min);
  Object.assign(finished, { state: done.state, events: done.events, last_seq: done.events.length, status: statusFor(done.state) });

  // Rooms for the demo admin to score.
  const soon = newMatch("22222222-2222-4222-8222-222222222222", "Mumbai Mavericks", "Bengaluru Bisons", now + 30 * min, DEMO_ADMIN_ID);
  const tomorrow = newMatch("44444444-4444-4444-8444-444444444444", "Jaipur Jaguars", "Patna Pythons", now + 24 * 60 * min, DEMO_ADMIN_ID);

  for (const m of [live, soon, tomorrow, finished]) matches.set(m.id, m);
  return { users, matches };
}

const globalStore = globalThis as typeof globalThis & { __kabaddiMock?: Store };

function store(): Store {
  globalStore.__kabaddiMock ??= seed();
  return globalStore.__kabaddiMock;
}

function publicRow(m: MockMatch): MatchRow {
  const { id, team_a, team_b, scheduled_at, status, state, updated_at } = m;
  return { id, team_a, team_b, scheduled_at, status, state, updated_at };
}

function roomRow(m: MockMatch): ScorerMatchRow {
  const { id, team_a, team_b, scheduled_at, status, state, updated_at, settings, scorer_id, last_seq } = m;
  return structuredClone({ id, team_a, team_b, scheduled_at, status, state, updated_at, settings, scorer_id, last_seq });
}

function sorted(): MockMatch[] {
  const now = Date.now();
  const all = [...store().matches.values()];
  for (const m of all) simulate(m, now);
  return all.sort((a, b) => Date.parse(a.scheduled_at ?? "") - Date.parse(b.scheduled_at ?? ""));
}

// --- public reads ---

export function mockListMatches(): MatchRow[] {
  return sorted().map(publicRow);
}

export function mockGetMatch(id: string): MatchRow | null {
  const m = store().matches.get(id);
  if (!m) return null;
  simulate(m, Date.now());
  return publicRow(m);
}

// --- admin ---

export function mockRoomsFor(userId: string): ScorerMatchRow[] {
  return sorted()
    .filter((m) => m.scorer_id === userId)
    .reverse()
    .map(roomRow);
}

export function mockRoom(id: string, userId: string): { match: ScorerMatchRow; events: MatchEvent[] } | null {
  const m = store().matches.get(id);
  if (!m || m.scorer_id !== userId) return null;
  return { match: roomRow(m), events: structuredClone(m.events) };
}

export function mockCreateRoom(input: {
  teamA: string;
  teamB: string;
  scheduledAt: string;
  settings: Settings;
  userId: string;
}): string {
  const id = randomUUID();
  store().matches.set(id, newMatch(id, input.teamA, input.teamB, Date.parse(input.scheduledAt), input.userId, input.settings));
  return id;
}

export function mockRecordEvent(id: string, userId: string, seq: number, event: MatchEvent, state: MatchState): MockWriteResult {
  const m = store().matches.get(id);
  if (!m || m.scorer_id !== userId) return { code: "KB404", message: "Match not found, or you are not its scorer." };
  if (seq === m.last_seq + 1) {
    m.events.push(event);
    m.last_seq = seq;
    m.state = state;
    m.status = statusFor(state);
    m.updated_at = new Date().toISOString();
    return "ok";
  }
  if (seq <= m.last_seq && JSON.stringify(m.events[seq - 1]) === JSON.stringify(event)) return "duplicate";
  return { code: "KB409", message: `Expected event ${m.last_seq + 1} but got ${seq}.` };
}

export function mockUndoLastEvent(id: string, userId: string, seq: number, state: MatchState): MockWriteResult {
  const m = store().matches.get(id);
  if (!m || m.scorer_id !== userId) return { code: "KB404", message: "Match not found, or you are not its scorer." };
  if (seq > m.last_seq) return "duplicate";
  if (seq !== m.last_seq) return { code: "KB409", message: `Only the last event (${m.last_seq}) can be undone, not ${seq}.` };
  m.events.pop();
  m.last_seq = seq - 1;
  m.state = state;
  m.status = statusFor(state);
  m.updated_at = new Date().toISOString();
  return "ok";
}

// --- auth ---

export function mockUser(id: string | undefined): { id: string; email: string } | null {
  const user = id ? store().users.get(id) : undefined;
  return user ? { id: user.id, email: user.email } : null;
}

export function mockSignIn(email: string, password: string): string | null {
  const user = [...store().users.values()].find((u) => u.email.toLowerCase() === email.toLowerCase());
  return user && user.password === password ? user.id : null;
}

export function mockSignUp(email: string, password: string): { id: string } | { error: string } {
  if ([...store().users.values()].some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    return { error: "That email is already registered. Log in instead." };
  }
  const id = randomUUID();
  store().users.set(id, { id, email, password });
  return { id };
}
