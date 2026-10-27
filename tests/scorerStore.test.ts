import { describe, expect, it } from "vitest";
import { createInitialState } from "@/lib/kabaddi";
import { ScorerStore } from "@/lib/scorerStore";
import type { QueueOp, SendOutcome, StorageLike } from "@/lib/syncQueue";

function setup(online = true) {
  const data = new Map<string, string>();
  const storage: StorageLike = {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
  const server = { online, sent: [] as QueueOp[] };
  const transport = async (op: QueueOp): Promise<SendOutcome> => {
    if (!server.online) throw new Error("offline");
    server.sent.push(op);
    return "ok";
  };
  const initial = createInitialState("Tigers", "Lions");
  const make = () => new ScorerStore(initial, [], initial, "q", transport, storage);
  return { server, store: make(), make };
}

describe("ScorerStore", () => {
  it("applies a tap locally and queues it with the next seq", async () => {
    const { store, server } = setup();
    store.dispatch({ type: "SET_RAIDING_TEAM", team: "A" }, 1);
    store.dispatch({ type: "START_RAID" }, 2);
    await store.flush();
    expect(store.getSnapshot().state.raid).not.toBeNull();
    expect(server.sent.map((o) => o.seq)).toEqual([1, 2]);
  });

  it("shows rejected taps as an error and queues nothing", async () => {
    const { store, server } = setup();
    expect(store.dispatch({ type: "START_RAID" }, 1)).toBe(false);
    expect(store.getSnapshot().error).toBe("Pick the raiding team first.");
    await store.flush();
    expect(server.sent).toEqual([]);
  });

  it("undo of an unsynced tap just removes it from the queue", async () => {
    const { store, server } = setup(false);
    store.dispatch({ type: "SET_RAIDING_TEAM", team: "A" }, 1);
    await store.flush();
    store.dispatch({ type: "START_CLOCK" }, 2);
    store.undo();
    expect(store.getSnapshot().sync.pending).toBe(1);

    server.online = true;
    await store.flush(); // the attempt already in flight started while offline and fails
    await store.flush(); // the 3-second retry
    expect(server.sent.map((o) => [o.kind, o.seq])).toEqual([["event", 1]]);
  });

  it("undo of a synced tap sends an undo op", async () => {
    const { store, server } = setup();
    store.dispatch({ type: "SET_RAIDING_TEAM", team: "A" }, 1);
    await store.flush();
    store.undo();
    await store.flush();
    expect(server.sent.map((o) => [o.kind, o.seq])).toEqual([["event", 1], ["undo", 1]]);
    expect(store.getSnapshot().state.raidingTeam).toBeNull();
  });

  it("keeps offline taps across a reload and shows them", async () => {
    const { store, make } = setup(false);
    store.dispatch({ type: "SET_RAIDING_TEAM", team: "B" }, 1);
    store.dispatch({ type: "START_RAID" }, 2);
    store.dispatch({ type: "TOUCH", n: 2 }, 3);
    await store.flush();

    const reloaded = make();
    expect(reloaded.getSnapshot().state.teams.B.score).toBe(2);
    expect(reloaded.getSnapshot().sync.pending).toBe(3);
    expect(reloaded.getServerSnapshot().state.teams.B.score).toBe(0);
  });

  it("fires RAID_TIMEOUT once at expiry, and not again after it is undone", () => {
    const { store } = setup();
    store.dispatch({ type: "SET_RAIDING_TEAM", team: "A" }, 0);
    store.dispatch({ type: "START_RAID" }, 1000);
    store.autoTick(31_500);
    expect(store.getSnapshot().log.at(-1)).toEqual({ type: "RAID_TIMEOUT", at: 31_000 });

    store.undo();
    store.autoTick(32_000);
    expect(store.getSnapshot().log.at(-1)?.type).toBe("START_RAID");
    expect(store.dispatch({ type: "TOUCH", n: 1 }, 32_100)).toBe(true);
  });
});
