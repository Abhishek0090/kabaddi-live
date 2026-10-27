import { describe, expect, it } from "vitest";
import { createInitialState } from "@/lib/kabaddi";
import type { MatchEvent } from "@/lib/kabaddi.types";
import {
  ConflictError,
  SyncQueue,
  mergePending,
  type QueueOp,
  type SendOutcome,
  type StorageLike,
} from "@/lib/syncQueue";

const state = createInitialState("Tigers", "Lions");

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

type EventOp = Extract<QueueOp, { kind: "event" }>;

const ev = (seq: number): EventOp => ({
  id: `e${seq}`,
  kind: "event",
  seq,
  event: { type: "START_RAID", at: seq },
  state,
});

const undo = (seq: number): QueueOp => ({ id: `u${seq}`, kind: "undo", seq, state });

/** Transport controlled by the test: `online` decides whether calls succeed. */
function fakeServer() {
  const server = {
    online: true,
    sent: [] as string[],
    transport: async (op: QueueOp): Promise<SendOutcome> => {
      if (!server.online) throw new Error("Failed to fetch");
      server.sent.push(op.id);
      return "ok";
    },
  };
  return server;
}

describe("SyncQueue", () => {
  it("sends ops in order and empties storage when synced", async () => {
    const server = fakeServer();
    const storage = memoryStorage();
    const q = new SyncQueue("k", server.transport, storage);
    q.push(ev(1));
    q.push(ev(2));
    q.push(ev(3));
    await q.flush();
    expect(server.sent).toEqual(["e1", "e2", "e3"]);
    expect(q.snapshot()).toEqual({ pending: 0, failing: false, conflict: null });
    expect(storage.data.size).toBe(0);
  });

  it("keeps taps made while offline and syncs them in order later", async () => {
    const server = fakeServer();
    server.online = false;
    const storage = memoryStorage();
    const q = new SyncQueue("k", server.transport, storage);
    q.push(ev(1));
    await q.flush();
    q.push(ev(2));
    await q.flush();
    q.push(ev(3));
    await q.flush();
    expect(q.snapshot()).toMatchObject({ pending: 3, failing: true });
    expect(JSON.parse(storage.data.get("k")!)).toHaveLength(3);

    server.online = true;
    await q.flush();
    expect(server.sent).toEqual(["e1", "e2", "e3"]);
    expect(q.snapshot()).toMatchObject({ pending: 0, failing: false });
  });

  it("survives a reload: a new queue picks up the stored ops", async () => {
    const server = fakeServer();
    server.online = false;
    const storage = memoryStorage();
    const first = new SyncQueue("k", server.transport, storage);
    first.push(ev(1));
    first.push(ev(2));
    await first.flush();

    server.online = true;
    const second = new SyncQueue("k", server.transport, storage);
    expect(second.pending.map((o) => o.id)).toEqual(["e1", "e2"]);
    await second.flush();
    expect(server.sent).toEqual(["e1", "e2"]);
  });

  it("drops an unsent last op (undo before sync) but not one in flight", async () => {
    let release: () => void = () => {};
    const sent: string[] = [];
    const q = new SyncQueue(
      "k",
      (op) =>
        new Promise<SendOutcome>((resolve) => {
          release = () => {
            sent.push(op.id);
            resolve("ok");
          };
        }),
      memoryStorage(),
    );
    q.push(ev(1)); // goes in flight
    expect(q.dropLastUnsent()).toBeNull();
    q.push(ev(2)); // waits behind e1
    expect(q.dropLastUnsent()?.id).toBe("e2");
    release();
    await q.flush();
    expect(sent).toEqual(["e1"]);
  });

  it("stops on a conflict and can discard", async () => {
    const q = new SyncQueue(
      "k",
      async () => {
        throw new ConflictError("Expected event 3 but got 5.");
      },
      memoryStorage(),
    );
    q.push(ev(5));
    await q.flush();
    expect(q.snapshot()).toEqual({ pending: 1, failing: false, conflict: "Expected event 3 but got 5." });
    q.discard();
    expect(q.snapshot()).toEqual({ pending: 0, failing: false, conflict: null });
  });

  it("treats a corrupt stored value as empty", () => {
    const storage = memoryStorage();
    storage.setItem("k", "{not json");
    expect(new SyncQueue("k", fakeServer().transport, storage).pending).toEqual([]);
  });
});

describe("mergePending", () => {
  const e = (at: number): MatchEvent => ({ type: "START_CLOCK", at });
  const server = [e(1), e(2), e(3), e(4)];

  it("appends events the server doesn't have yet", () => {
    const op: QueueOp = { ...ev(5), event: e(5) };
    expect(mergePending(server, [op])).toEqual([...server, e(5)]);
  });

  it("skips ops the server already applied and applies the rest", () => {
    const synced: QueueOp = { ...ev(4), event: e(4) };
    expect(mergePending(server, [synced, undo(4)])).toEqual(server.slice(0, 3));
  });

  it("skips an undo the server already applied", () => {
    const next: QueueOp = { ...ev(4), event: e(40) };
    expect(mergePending(server.slice(0, 3), [undo(4), next])).toEqual([...server.slice(0, 3), e(40)]);
  });
});
