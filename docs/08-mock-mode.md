# 08 Mock mode

`NEXT_PUBLIC_MOCK=true` runs the app with no Supabase project. Code: [src/lib/mock/](../src/lib/mock/), flag: [src/lib/mode.ts](../src/lib/mode.ts).

## What is replaced

| Real | Mock replacement |
| --- | --- |
| Postgres tables | `globalThis.__kabaddiMock` in [store.ts](../src/lib/mock/store.ts), a Map of users and matches |
| `record_event`, `undo_last_event` | `mockRecordEvent`, `mockUndoLastEvent`, called through server actions in [actions.ts](../src/lib/mock/actions.ts). Same `seq` and duplicate rules, same `KB404` and `KB409` codes |
| Supabase Auth | Plain email and password in memory, and a cookie `kabaddi-mock-session` holding the user id ([session.ts](../src/lib/mock/session.ts)) |
| Realtime | Polling `/api/mock/matches/[id]` every second |
| `server_now()` | Not used; the offset stays 0 |

Every place that branches on mock mode checks `MOCK` from `src/lib/mode.ts`: `matches.ts`, `adminData.ts`, `auth.ts`, `login/actions.ts`, `proxy.ts`, `ControlPanel.tsx`, `useLiveMatch.ts`, `useServerClock.ts`.

## Seed data

Created the first time the store is used:

| Match | Owner | Behaviour |
| --- | --- | --- |
| Kolhapur Kings vs Nashik Ninjas | System (no login) | Plays itself; 8-minute halves; restarts 2 minutes after full time |
| Mumbai Mavericks vs Bengaluru Bisons | Demo admin | Starts in 30 minutes; score it yourself |
| Jaipur Jaguars vs Patna Pythons | Demo admin | Tomorrow |
| Hyderabad Hawks vs Kolkata Comets | Demo admin | Finished yesterday, played by the simulator |

Demo admin: `demo@kabaddi.app` / `kabaddi123`.

## The simulator

[simulate.ts](../src/lib/mock/simulate.ts) plays a match through the real rules engine.

- Seeded random numbers, so a seed always produces the same match.
- `advance(state, now)` applies every event due up to `now`. The store calls it whenever a match is read, so the demo match is up to date on every request without a background timer.
- Each step is a toss, a raid start, a raid result (touch, bonus, empty, tackle), an occasional timeout, a half end or the second-half start.
- Every event goes through `applyEvent`, so it can never produce an invalid state. [tests/simulate.test.ts](../tests/simulate.test.ts) checks a full match replays exactly.

## Limits

- Data lives in one server process and resets on restart. Registered demo users are lost too; their old cookie then sends them back to login.
- On Vercel or any multi-instance host, each instance has its own store, so data is inconsistent. Mock mode is for local use and demos only.
- Mock login is not secure: the cookie is just a user id. Never turn mock mode on for real matches.
