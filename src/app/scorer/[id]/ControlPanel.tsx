"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { MatDots } from "@/components/MatDots";
import { btn, teamBg, teamText } from "@/components/ui";
import { isRunning } from "@/lib/clock";
import type { ScorerMatchRow } from "@/lib/db.types";
import { matchView } from "@/lib/display";
import { eventToRow } from "@/lib/events";
import { eventLabel, formatClock, formatSeconds } from "@/lib/format";
import { createInitialState, other } from "@/lib/kabaddi";
import { mockRecordEventAction, mockUndoAction } from "@/lib/mock/actions";
import { MOCK } from "@/lib/mode";
import type { MatchEvent, Team } from "@/lib/kabaddi.types";
import { ScorerStore, type EventInput } from "@/lib/scorerStore";
import { serverNow } from "@/lib/serverTime";
import { createClient } from "@/lib/supabase/client";
import { ConflictError, type StorageLike, type SyncSnapshot, type Transport } from "@/lib/syncQueue";
import { useNow } from "@/lib/useNow";
import { useServerClock } from "@/lib/useServerClock";

function makeTransport(matchId: string): Transport {
  if (MOCK) {
    return async (op) => {
      const result =
        op.kind === "event"
          ? await mockRecordEventAction(matchId, op.seq, op.event, op.state)
          : await mockUndoAction(matchId, op.seq, op.state);
      if (typeof result === "object") throw new ConflictError(result.message);
      return result;
    };
  }
  let client: ReturnType<typeof createClient> | null = null;
  return async (op) => {
    client ??= createClient();
    const { data, error } =
      op.kind === "event"
        ? await client.rpc("record_event", {
            p_match: matchId,
            p_seq: op.seq,
            p_type: eventToRow(op.event).type,
            p_payload: eventToRow(op.event).payload,
            p_state: op.state,
          })
        : await client.rpc("undo_last_event", { p_match: matchId, p_seq: op.seq, p_state: op.state });
    if (error) {
      if (error.code === "KB409" || error.code === "KB404") throw new ConflictError(error.message);
      throw new Error(error.message);
    }
    return data === "duplicate" ? "duplicate" : "ok";
  };
}

function browserStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

type Confirm = { kind: "undo"; label: string } | { kind: "endHalf" } | null;

export function ControlPanel({ match, events }: { match: ScorerMatchRow; events: MatchEvent[] }) {
  const [store] = useState(
    () =>
      new ScorerStore(
        createInitialState(match.team_a, match.team_b, match.settings),
        events,
        match.state,
        `kabaddi:queue:${match.id}`,
        makeTransport(match.id),
        browserStorage(),
      ),
  );
  const snap = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const now = useNow(200);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [moreTouches, setMoreTouches] = useState(false);
  useServerClock();

  // Send queued taps now, every 3 seconds while any are pending, and when the network returns.
  useEffect(() => {
    void store.flush();
    const retry = setInterval(() => {
      if (store.getSnapshot().sync.pending > 0) void store.flush();
    }, 3000);
    const onOnline = () => void store.flush();
    window.addEventListener("online", onOnline);
    return () => {
      clearInterval(retry);
      window.removeEventListener("online", onOnline);
    };
  }, [store]);

  // Clock expiry: this device ends the half or the raid without anyone tapping.
  useEffect(() => {
    const id = setInterval(() => store.autoTick(serverNow()), 200);
    return () => clearInterval(id);
  }, [store]);

  const { state, sync, error } = snap;
  const view = matchView(state, now);
  const tap = (input: EventInput) => store.dispatch(input, serverNow());
  const raider = state.raidingTeam;
  const defender = raider ? other(raider) : null;
  const clockRunning = isRunning(state.matchClock);
  const lastEvent = snap.log.at(-1);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-3 px-3 py-3 text-zinc-950 dark:text-zinc-50">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/scorer" className="min-h-11 content-center text-sm font-semibold underline">
          My rooms
        </Link>
        <h1 className="text-lg font-black">
          {match.team_a} vs {match.team_b}
        </h1>
        <div className="flex items-center gap-2">
          <SyncBadge sync={sync} onReload={() => {
            store.discardPending();
            window.location.reload();
          }} />
          <Link href={`/match/${match.id}`} target="_blank" className="min-h-11 content-center text-sm font-semibold underline">
            Scoreboard
          </Link>
        </div>
      </header>

      {/* Score strip */}
      <section className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2 rounded-2xl bg-zinc-950 p-3 text-white">
        <TeamScore team="A" name={state.teams.A.name} score={state.teams.A.score} onMat={state.teams.A.mat.length}
          total={state.settings.playersOnMat} timeoutsLeft={state.teams.A.timeoutsLeft} raiding={raider === "A"} />
        <div className="flex min-w-28 flex-col items-center justify-center gap-1 px-2">
          <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">
            {state.half === 1 ? "1st half" : "2nd half"}
          </span>
          <span className="font-mono text-4xl font-black tabular-nums sm:text-5xl">{formatClock(view.matchMs)}</span>
          {view.raidMs !== null && (
            <span className="rounded-lg bg-white px-2 font-mono text-2xl font-black text-zinc-950 tabular-nums">
              {formatSeconds(view.raidMs)}s
            </span>
          )}
          {view.doOrDie && <span className="rounded bg-red-600 px-2 text-xs font-black uppercase">Do or die</span>}
        </div>
        <TeamScore team="B" name={state.teams.B.name} score={state.teams.B.score} onMat={state.teams.B.mat.length}
          total={state.settings.playersOnMat} timeoutsLeft={state.teams.B.timeoutsLeft} raiding={raider === "B"} />
      </section>

      {view.banner && (
        <p className="rounded-xl bg-amber-300 px-4 py-2 text-center text-lg font-black text-zinc-950">
          {view.banner.title}
          {view.banner.detail && ` - ${view.banner.detail}`}
        </p>
      )}
      <p role="alert" aria-live="assertive" className="min-h-7 text-center text-lg font-bold text-red-700 dark:text-red-400">
        {error}
      </p>

      <div className="grid gap-3 md:grid-cols-[2fr_3fr]">
        {/* Match controls */}
        <section className="flex flex-col gap-3 rounded-2xl border-2 border-zinc-200 p-3 dark:border-zinc-800">
          <h2 className="text-sm font-black uppercase tracking-wide text-zinc-500">Match</h2>
          <div className="grid grid-cols-2 gap-2">
            {state.phase === "halftime" ? (
              <button className={`${btn.primary} col-span-2`} onClick={() => tap({ type: "START_SECOND_HALF" })}>
                Start 2nd half
              </button>
            ) : state.phase === "fulltime" ? (
              <p className="col-span-2 text-center text-lg font-bold">Match finished</p>
            ) : (
              <>
                <button
                  className={clockRunning ? btn.dark : btn.primary}
                  onClick={() => tap({ type: clockRunning ? "PAUSE_CLOCK" : "START_CLOCK" })}
                >
                  {clockRunning ? "Pause clock" : "Start clock"}
                </button>
                <button className={btn.secondary} onClick={() => setConfirm({ kind: "endHalf" })}>
                  End half
                </button>
              </>
            )}
          </div>
          <button
            className={btn.secondary}
            disabled={!lastEvent}
            onClick={() => lastEvent && setConfirm({ kind: "undo", label: eventLabel(lastEvent, state) })}
          >
            Undo{lastEvent ? `: ${eventLabel(lastEvent, state)}` : ""}
          </button>

          <h2 className="mt-1 text-sm font-black uppercase tracking-wide text-zinc-500">Timeouts</h2>
          <div className="grid grid-cols-2 gap-2">
            {(["A", "B"] as const).map((t) => (
              <button key={t} className={btn.secondary} onClick={() => tap({ type: "TIMEOUT", team: t })}>
                <span className={teamText[t]}>{state.teams[t].name}</span>
                <span className="rounded-md bg-zinc-200 px-2 text-base tabular-nums text-zinc-900">
                  {state.teams[t].timeoutsLeft}
                </span>
              </button>
            ))}
          </div>
          {state.timeout && (
            <button className={btn.dark} onClick={() => tap({ type: "RESUME" })}>
              End timeout now
            </button>
          )}
        </section>

        {/* Raid controls */}
        <section className="flex flex-col gap-3 rounded-2xl border-2 border-zinc-200 p-3 dark:border-zinc-800">
          <h2 className="text-sm font-black uppercase tracking-wide text-zinc-500">
            {raider ? "Raiding team" : "Toss: who raids first?"}
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {(["A", "B"] as const).map((t) => (
              <button
                key={t}
                aria-pressed={raider === t}
                className={
                  raider === t
                    ? `${btn.primary} ${teamBg[t]} ring-4 ring-zinc-950 dark:ring-white`
                    : btn.secondary
                }
                onClick={() => tap({ type: "SET_RAIDING_TEAM", team: t })}
              >
                {state.teams[t].name} raids
              </button>
            ))}
          </div>

          {state.raid ? (
            <button className={btn.dark} onClick={() => tap({ type: "STOP_RAID" })}>
              Stop raid (no result)
            </button>
          ) : (
            <button className={`${btn.primary} min-h-16 text-xl`} onClick={() => tap({ type: "START_RAID" })}>
              Start raid{raider ? `: ${state.teams[raider].name}` : ""}
            </button>
          )}

          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3].map((n) => (
              <button key={n} className={`${btn.primary} bg-green-700 hover:bg-green-600`} onClick={() => tap({ type: "TOUCH", n })}>
                Touch {n}
              </button>
            ))}
            <button className={btn.secondary} aria-expanded={moreTouches} onClick={() => setMoreTouches((v) => !v)}>
              {moreTouches ? "Less" : "4+"}
            </button>
            {moreTouches &&
              Array.from({ length: Math.max(0, state.settings.playersOnMat - 3) }, (_, i) => i + 4).map((n) => (
                <button key={n} className={`${btn.primary} bg-green-700 hover:bg-green-600`} onClick={() => tap({ type: "TOUCH", n })}>
                  Touch {n}
                </button>
              ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button className={`${btn.primary} bg-green-700 hover:bg-green-600`} onClick={() => tap({ type: "BONUS" })}>
              Bonus +1
            </button>
            <button className={btn.secondary} onClick={() => tap({ type: "EMPTY_RAID" })}>
              Empty raid
            </button>
            <button className={btn.danger} onClick={() => tap({ type: "TACKLE" })}>
              Raider tackled
            </button>
          </div>
          {defender && (
            <p className="text-sm text-zinc-500">
              {state.teams[defender].name} defending with {state.teams[defender].mat.length} on the mat.
            </p>
          )}
        </section>
      </div>

      <section className="rounded-2xl border-2 border-zinc-200 p-3 dark:border-zinc-800">
        <h2 className="text-sm font-black uppercase tracking-wide text-zinc-500">Last events</h2>
        <ol className="mt-1 flex flex-col gap-1">
          {state.feed.slice(0, 5).map((item) => (
            <li key={`${item.at}-${item.text}`} className={`font-semibold ${item.team ? teamText[item.team] : ""}`}>
              {item.text}
            </li>
          ))}
          {state.feed.length === 0 && <li className="text-zinc-500">No events yet.</li>}
        </ol>
      </section>

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.kind === "undo" ? `Undo "${confirm.label}"?` : "End this half now?"}
        confirmLabel={confirm?.kind === "undo" ? "Undo" : "End half"}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm?.kind === "undo") store.undo();
          else tap({ type: "END_HALF" });
          setConfirm(null);
        }}
      />
    </main>
  );
}

function TeamScore(props: {
  team: Team;
  name: string;
  score: number;
  onMat: number;
  total: number;
  timeoutsLeft: number;
  raiding: boolean;
}) {
  return (
    <div className={`flex flex-col items-center gap-1 rounded-xl p-2 ${props.raiding ? "bg-white/10 ring-2 ring-white" : ""}`}>
      <span className={`line-clamp-1 text-center text-base font-black sm:text-xl ${props.team === "A" ? "text-orange-400" : "text-sky-400"}`}>
        {props.name}
      </span>
      <span className="text-6xl font-black leading-none tabular-nums sm:text-7xl">{props.score}</span>
      <MatDots team={props.team} onMat={props.onMat} total={props.total} className="h-3.5 w-3.5" />
      <span className="text-xs text-zinc-400">
        {props.raiding ? "Raiding - " : ""}Timeouts {props.timeoutsLeft}
      </span>
    </div>
  );
}

function SyncBadge({ sync, onReload }: { sync: SyncSnapshot; onReload: () => void }) {
  if (sync.conflict) {
    return (
      <span className="flex items-center gap-2 rounded-lg bg-red-700 px-3 py-1 text-sm font-bold text-white">
        Sync problem
        <button className="underline" onClick={onReload} title={sync.conflict}>
          Reload from server
        </button>
      </span>
    );
  }
  if (sync.pending > 0) {
    return (
      <span className="rounded-lg bg-amber-400 px-3 py-1 text-sm font-black text-zinc-950" aria-live="polite">
        Not synced ({sync.pending} pending){sync.failing ? ", retrying" : ""}
      </span>
    );
  }
  return <span className="rounded-lg bg-green-700 px-3 py-1 text-sm font-bold text-white">Synced</span>;
}
