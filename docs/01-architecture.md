# 01 Architecture

How the parts of the app fit together, where each part lives, and why it is built this way.

## The big picture

```text
 Scorer's tablet (/scorer/[id])                 Supabase (Postgres + Realtime)
 +-------------------------------+              +------------------------------+
 | tap -> rules engine (local)   |  RPC calls   | record_event / undo_last_    |
 |      -> screen updates now    | -----------> | event: saves event + state   |
 |      -> offline queue         |  in order,   | in one transaction           |
 |         (localStorage)        |  retried     |                              |
 | clock expiry -> auto events   |              | matches row UPDATE           |
 +-------------------------------+              +--------------+---------------+
                                                               | Realtime
                                                               | (postgres_changes)
                       +---------------------------------------+------------+
                       v                                                    v
            Public scoreboard (/match/[id])                    OBS overlay (/overlay/[id])
            + home page featured match                         transparent scorebug
            each screen computes clocks locally from the stored timestamps
```

In mock mode the right-hand box is replaced by an in-memory store on the Next.js server, and Realtime is replaced by polling every second. See [08 Mock mode](08-mock-mode.md).

## Folder map

```text
src/
  proxy.ts                 login guard for /scorer, refreshes the Supabase session
  app/                     routes (Next.js App Router)
    page.tsx               home: hero, featured live match, match lists
    match/[id]/            public scoreboard (server page + LiveScoreboard client)
    overlay/[id]/          OBS overlay (server page + Overlay client)
    login/, register/      auth pages; login/actions.ts holds all auth server actions
    auth/callback/         email confirmation landing route
    scorer/                admin: room list + create form
    scorer/[id]/           control panel (server page + ControlPanel client)
    api/mock/matches/[id]/ mock mode only: JSON for polling
    manifest.ts, icon.tsx, apple-icon.tsx, pwa-icon/[size]/   PWA
  components/              shared UI (header, logo, cards, dialogs, badges)
  lib/
    kabaddi.ts             rules engine (pure)
    kabaddi.types.ts       MatchState, MatchEvent, Settings
    clock.ts               clock maths (pure)
    display.ts             what a screen shows at time t; clock-expiry detection (pure)
    format.ts              text formatting (pure)
    settings.ts            create-room form parsing (pure)
    events.ts              event <-> database row conversion
    syncQueue.ts           ordered, persisted write queue
    scorerStore.ts         control panel state: taps, undo, auto events
    serverTime.ts          server clock offset
    useLiveMatch.ts        live copy of a match (Realtime or polling)
    useNow.ts, useServerClock.ts   ticking time hooks
    matches.ts             public data reads (server)
    adminData.ts           admin data reads/writes (server)
    auth.ts                requireAdmin() for admin pages (server)
    db.types.ts            TypeScript types for the database
    mode.ts                MOCK flag
    mock/                  mock backend: store, simulator, session, actions
    supabase/              Supabase clients (browser, server, proxy) and env check
supabase/schema.sql        tables, RLS, RPCs, realtime publication
supabase/seed.sql          optional demo match
public/sw.js               service worker
tests/                     Vitest suites
scripts/share*.mjs         npm run share
```

## Main design decisions

### Event sourcing on the client

Every scoring action is an event, for example `{ type: "TOUCH", n: 2, at: 1761580000000 }`. The rules engine turns `(state, event)` into a new state. The full list of events is stored in `match_events`; the latest state is stored in `matches.state` so public pages can read one row.

Why: undo becomes trivial and exact (replay without the last event), the scorer can keep working offline, and the engine can be tested without a database.

Trade-off: the database trusts the state the scorer's device sends. That is acceptable because only the room's own admin can write, and RLS enforces that.

### Clocks as timestamps

A clock is `{ runningSince, remainingMs }`. Displayed time is `remainingMs - (now - runningSince)`. No device sends ticks, so a slow network never makes clocks jump. Events carry their own time (`at`), so replaying a log always gives the same clocks.

All devices correct their own clock against the server with `server_now()`, so a tablet whose clock is 20 seconds off still shows the right time. See [04 Scoring and sync](04-scoring-and-sync.md#server-time).

### Clock expiry is decided by the scorer's device

When the match clock or raid clock reaches zero, the control panel sends `END_HALF` or `RAID_TIMEOUT`, stamped with the exact expiry time. Public screens also show "Half time" as soon as their own clock reaches 00:00, so they look right even before that event arrives.

### Pure core, thin edges

Everything that decides behaviour is a pure function or a plain class with no React and no network: `kabaddi.ts`, `clock.ts`, `display.ts`, `syncQueue.ts`, `scorerStore.ts`, `mock/simulate.ts`. React components and Supabase calls are thin wrappers around them. Most bugs can be reproduced in a unit test.

## Request flow per route

| Route | Rendered | Data source | Live updates |
| --- | --- | --- | --- |
| `/` | Server, per request | `listMatches()` in `lib/matches.ts` | Featured card only, via `useLiveMatch` |
| `/match/[id]` | Server, then client | `getMatch()` | `useLiveMatch` |
| `/overlay/[id]` | Server, then client | `getMatch()` | `useLiveMatch` |
| `/scorer` | Server | `listMyRooms()` in `lib/adminData.ts` | None (reload) |
| `/scorer/[id]` | Server, then client | `getRoom()` | It is the source of updates |
| `/login`, `/register` | Server + client form | Server actions in `login/actions.ts` | None |
