# 04 Scoring and sync

What happens between a tap on the control panel and the score reaching the database. Code: [src/lib/scorerStore.ts](../src/lib/scorerStore.ts), [src/lib/syncQueue.ts](../src/lib/syncQueue.ts), [src/app/scorer/[id]/ControlPanel.tsx](../src/app/scorer/[id]/ControlPanel.tsx).

## The life of a tap

1. The button calls `store.dispatch({ type: "TOUCH", n: 2 }, serverNow())`.
2. `ScorerStore` runs the event through `applyEvent`.
   - Rejected: it sets `error` and the panel shows it under the score. Nothing is queued.
   - Accepted: it appends the event to the local log and updates the state. The screen re-renders at once.
3. It pushes an op to the `SyncQueue`: `{ id, kind: "event", seq, event, state }`. `seq` is the event's position in the log, starting at 1.
4. The queue saves itself to localStorage, then sends ops one at a time, in order.
5. When the server confirms an op, the queue removes it and saves again.

The op carries the full new state, so sending never depends on what the UI is showing at the time.

## The sync queue

| Behaviour | Detail |
| --- | --- |
| Storage key | `kabaddi:queue:<matchId>` in localStorage |
| Order | Strictly one op at a time; later ops wait |
| Retry | Every 3 seconds while anything is pending, and on the browser `online` event |
| Network or server error | Op stays queued, badge shows "Not synced (n pending), retrying" |
| Conflict (`KB409`, `KB404`) | Queue stops, badge shows "Sync problem" with "Reload from server" |
| Reply `duplicate` | Treated as success. It means a retry found the op already applied |

### Why retries are safe

The RPCs check `seq`. If a response was lost and the same op is sent again, the server finds the same event already stored at that `seq` and returns `duplicate` instead of saving it twice. See [05 Database](05-database.md#rpcs).

### Reloading with unsent taps

When the control panel opens, `ScorerStore` loads the server's log and then applies any ops still in localStorage on top (`mergePending`). Ops the server already has are skipped. So a scorer who loses signal, taps three times and reloads still sees all three taps, and they sync when the network returns.

The page first renders the server's copy, then switches to the merged copy. This avoids a hydration mismatch, because the server cannot read localStorage.

## Undo

`store.undo()`:

1. Replays the log without its last event and shows the result.
2. If that last event is still in the queue and not being sent right now, it simply removes it. Nothing goes to the server.
3. Otherwise it queues `{ kind: "undo", seq, state }`. The server deletes that event only if it is still the last one.

Undo and End half are the only actions with a confirmation dialog.

## Automatic events

Every 200 ms the panel calls `store.autoTick(serverNow())`, which uses `dueAutoEvent` from [src/lib/display.ts](../src/lib/display.ts):

| Condition | Event sent | `at` |
| --- | --- | --- |
| Timeout has run out | `RESUME` | `timeout.endsAt` |
| Match clock reached 0 | `END_HALF` | The exact expiry time |
| Raid clock reached 0 | `RAID_TIMEOUT` | The exact expiry time |

If the half ends during a raid, `END_HALF` wins, because it cancels the raid anyway.

Each auto event fires once (`autoFired`). If the scorer undoes an automatic `RAID_TIMEOUT`, it does not fire again, so they can record the real result instead.

Auto events need the control panel open. If the tablet sleeps, nothing is sent until it wakes. Public screens show "Half time" from their own clock in the meantime.

## Server time

[src/lib/serverTime.ts](../src/lib/serverTime.ts) keeps `offset = server time - device time`.

- `syncServerTime()` calls the `server_now()` RPC three times and keeps the sample with the shortest round trip. It adds half the round trip to correct for network delay.
- It runs on page load, when the network returns, and when the tab becomes visible again (`useServerClock`).
- The offset is saved in localStorage as `kabaddi:clock-offset`, so an offline scorer still stamps events with corrected time.
- In mock mode the offset stays 0.

Every event's `at` and every displayed clock use `serverNow()`.

## Hooks used by the panel

| Hook | Purpose |
| --- | --- |
| `useSyncExternalStore(store.subscribe, ...)` | Reads `ScorerStore` without stale renders |
| `useNow(200)` | Re-renders the clocks 5 times a second |
| `useServerClock()` | Keeps the server offset fresh |
