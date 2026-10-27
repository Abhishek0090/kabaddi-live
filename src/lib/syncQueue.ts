import type { MatchEvent, MatchState } from "./kabaddi.types";

/** One pending write. Carries the state to save, so sending never depends on UI state. */
export type QueueOp = ({ kind: "event"; event: MatchEvent } | { kind: "undo" }) & {
  id: string;
  seq: number;
  state: MatchState;
};

export type SendOutcome = "ok" | "duplicate";

/** The server refused the op for good (wrong seq, not your match). Retrying won't help. */
export class ConflictError extends Error {}

export type Transport = (op: QueueOp) => Promise<SendOutcome>;

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type SyncSnapshot = {
  pending: number;
  /** The last attempt failed with a network or server error and will be retried. */
  failing: boolean;
  conflict: string | null;
};

/**
 * Ordered, persisted write queue. Ops are saved before they are sent and only
 * removed once the server confirms them, so a tap survives reloads and outages.
 */
export class SyncQueue {
  private ops: QueueOp[];
  private sendingId: string | null = null;
  private running: Promise<void> | null = null;
  private failing = false;
  private conflict: string | null = null;

  constructor(
    private readonly key: string,
    private readonly transport: Transport,
    private readonly storage: StorageLike | null,
    private readonly onChange: () => void = () => {},
  ) {
    this.ops = this.load();
  }

  get pending(): readonly QueueOp[] {
    return this.ops;
  }

  snapshot(): SyncSnapshot {
    return { pending: this.ops.length, failing: this.failing, conflict: this.conflict };
  }

  push(op: QueueOp): void {
    this.ops.push(op);
    this.save();
    this.onChange();
    void this.flush();
  }

  /** Removes the newest op if it is not being sent right now. */
  dropLastUnsent(): QueueOp | null {
    const last = this.ops.at(-1);
    if (!last || last.id === this.sendingId) return null;
    this.ops.pop();
    this.save();
    this.onChange();
    return last;
  }

  /** Sends ops in order, one at a time. Stops at the first failure. */
  flush(): Promise<void> {
    this.running ??= this.run().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  /** Forgets every pending op. Used after a conflict, before reloading from the server. */
  discard(): void {
    this.ops = [];
    this.conflict = null;
    this.failing = false;
    this.save();
    this.onChange();
  }

  private async run(): Promise<void> {
    while (this.ops.length > 0 && !this.conflict) {
      const op = this.ops[0];
      this.sendingId = op.id;
      try {
        await this.transport(op);
      } catch (e) {
        if (e instanceof ConflictError) this.conflict = e.message;
        else this.failing = true;
        this.onChange();
        return;
      } finally {
        this.sendingId = null;
      }
      this.failing = false;
      if (this.ops[0]?.id === op.id) this.ops.shift();
      this.save();
      this.onChange();
    }
  }

  private load(): QueueOp[] {
    try {
      const raw = this.storage?.getItem(this.key);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? (parsed as QueueOp[]) : [];
    } catch {
      return [];
    }
  }

  private save(): void {
    try {
      if (this.ops.length) this.storage?.setItem(this.key, JSON.stringify(this.ops));
      else this.storage?.removeItem(this.key);
    } catch {
      // Storage full or blocked. The ops still live in memory for this session.
    }
  }
}

/** Rebuilds the local log from the server log plus ops a previous session didn't sync. */
export function mergePending(serverLog: readonly MatchEvent[], ops: readonly QueueOp[]): MatchEvent[] {
  const log = [...serverLog];
  for (const op of ops) {
    if (op.kind === "event" && op.seq === log.length + 1) log.push(op.event);
    else if (op.kind === "undo" && op.seq === log.length) log.pop();
    // Anything else was already applied on the server before the page loaded.
  }
  return log;
}

export function newOpId(): string {
  // crypto.randomUUID needs a secure context; tablets on a LAN IP over http don't have one.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
