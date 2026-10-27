# Kabaddi Live Score: developer docs

These docs explain how the code works and how to change it safely. For setup and deployment steps, start with the [project README](../README.md).

## What the app does

A match admin creates a room for a match and scores it from a tablet or phone. Each tap is applied on the device straight away, saved to the database, and pushed to a public scoreboard and an OBS overlay within about a second. It runs on free tiers: Vercel Hobby, Supabase Free and GitHub Actions. With `NEXT_PUBLIC_MOCK=true` it runs on in-memory demo data with no Supabase at all.

## Reading order

| Doc | Read it when you want to know |
| --- | --- |
| [01 Architecture](01-architecture.md) | How the pieces fit, where code lives, and the main design decisions |
| [02 Getting started](02-getting-started.md) | Run modes, env vars and npm scripts |
| [03 Rules engine](03-rules-engine.md) | How kabaddi scoring is modelled in `src/lib/kabaddi.ts` |
| [04 Scoring and sync](04-scoring-and-sync.md) | What happens when the scorer taps a button, offline queue, undo, clocks |
| [05 Database](05-database.md) | Tables, row level security, RPCs and realtime |
| [06 Public pages](06-public-pages.md) | Home page, scoreboard, overlay, live updates |
| [07 Auth and admin](07-auth-and-admin.md) | Register, login, the proxy, rooms and the control panel route |
| [08 Mock mode](08-mock-mode.md) | The in-memory demo backend and the match simulator |
| [09 PWA](09-pwa.md) | Manifest, icons, service worker and offline behaviour |
| [10 Testing](10-testing.md) | What the tests cover and the manual checks still needed |
| [11 Making changes](11-making-changes.md) | Step-by-step recipes, and changes needed before real use |
| [12 Sharing the code](12-sharing.md) | `npm run share` and the setup and update scripts |

## Five facts to keep in mind

1. **The event log is the source of truth.** Match state is always the result of replaying events through the rules engine. Undo is "replay without the last event".
2. **The scorer's device computes the state.** The database stores what the device sends; it does not run kabaddi rules itself.
3. **Clocks are never stored ticking.** State stores when a clock started and how much time was left then. Every screen computes the display.
4. **Every tap is saved on the device before it is sent.** The offline queue in localStorage only drops a tap once the server confirms it.
5. **Only the room's admin can write to it.** Row level security in Postgres enforces this, not just the UI.
