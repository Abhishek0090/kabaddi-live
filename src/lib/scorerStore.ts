import { dueAutoEvent } from "./display";
import { applyEvent, replay } from "./kabaddi";
import type { MatchEvent, MatchState } from "./kabaddi.types";
import {
  SyncQueue,
  mergePending,
  newOpId,
  type StorageLike,
  type SyncSnapshot,
  type Transport,
} from "./syncQueue";

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** An event as a button produces it; the store stamps the time. */
export type EventInput = DistributiveOmit<MatchEvent, "at">;

export type ScorerSnapshot = {
  log: readonly MatchEvent[];
  state: MatchState;
  sync: SyncSnapshot;
  error: string | null;
};

const AUTO_TYPES = new Set<MatchEvent["type"]>(["END_HALF", "RAID_TIMEOUT", "RESUME"]);

/**
 * Scorer-side match state: applies taps optimistically, queues them for the
 * server, and fires clock-expiry events. Lives outside React so the queue and
 * timers never see a stale render.
 */
export class ScorerStore {
  readonly serverSnapshot: ScorerSnapshot;
  private snap: ScorerSnapshot;
  private readonly queue: SyncQueue;
  private readonly listeners = new Set<() => void>();
  /** Auto events already fired once (`type:at`). Undoing one must not re-fire it. */
  private readonly autoFired = new Set<string>();

  constructor(
    private readonly initial: MatchState,
    serverLog: readonly MatchEvent[],
    serverState: MatchState,
    storageKey: string,
    transport: Transport,
    storage: StorageLike | null,
  ) {
    const base = replay(initial, serverLog);
    this.serverSnapshot = {
      log: serverLog,
      state: base.ok ? base.state : serverState,
      sync: { pending: 0, failing: false, conflict: null },
      error: base.ok ? null : `Saved events don't replay cleanly: ${base.error}`,
    };
    this.queue = new SyncQueue(storageKey, transport, storage, () => this.set({ sync: this.queue.snapshot() }));

    let snap = this.serverSnapshot;
    if (this.queue.pending.length > 0) {
      const log = mergePending(serverLog, this.queue.pending);
      const merged = replay(initial, log);
      if (merged.ok) snap = { ...snap, log, state: merged.state };
      snap = { ...snap, sync: this.queue.snapshot() };
    }
    this.snap = snap;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): ScorerSnapshot => this.snap;

  getServerSnapshot = (): ScorerSnapshot => this.serverSnapshot;

  flush(): Promise<void> {
    return this.queue.flush();
  }

  /** Applies an event locally and queues it. Returns false (and sets `error`) when the rules reject it. */
  dispatch(input: EventInput, at: number): boolean {
    const event = { ...input, at } as MatchEvent;
    const result = applyEvent(this.snap.state, event);
    if (!result.ok) {
      this.set({ error: result.error });
      return false;
    }
    const log = [...this.snap.log, event];
    this.set({ log, state: result.state, error: null });
    this.queue.push({ id: newOpId(), kind: "event", seq: log.length, event, state: result.state });
    return true;
  }

  undo(): void {
    const { log } = this.snap;
    if (log.length === 0) {
      this.set({ error: "Nothing to undo." });
      return;
    }
    const nextLog = log.slice(0, -1);
    const result = replay(this.initial, nextLog);
    if (!result.ok) {
      this.set({ error: result.error });
      return;
    }
    this.set({ log: nextLog, state: result.state, error: null });

    // If the undone event never reached the server, just don't send it.
    const last = this.queue.pending.at(-1);
    const unsent = last?.kind === "event" && last.seq === log.length && this.queue.dropLastUnsent() !== null;
    if (!unsent) this.queue.push({ id: newOpId(), kind: "undo", seq: log.length, state: result.state });
  }

  /** Call on every tick: sends END_HALF, RAID_TIMEOUT or RESUME when a clock runs out. */
  autoTick(now: number): void {
    const event = dueAutoEvent(this.snap.state, now);
    if (!event) return;
    const key = `${event.type}:${event.at}`;
    if (this.autoFired.has(key)) return;
    this.autoFired.add(key);
    const { at, ...input } = event;
    this.dispatch(input as EventInput, at);
  }

  lastEvent(): MatchEvent | undefined {
    return this.snap.log.at(-1);
  }

  isAutoEvent(event: MatchEvent): boolean {
    return AUTO_TYPES.has(event.type);
  }

  clearError(): void {
    if (this.snap.error) this.set({ error: null });
  }

  /** After a conflict: drop pending ops so a reload starts from the server's copy. */
  discardPending(): void {
    this.queue.discard();
  }

  private set(patch: Partial<ScorerSnapshot>): void {
    this.snap = { ...this.snap, ...patch };
    for (const listener of this.listeners) listener();
  }
}
