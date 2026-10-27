# 10 Testing

## Automated tests

Run with `npm test`. All suites are in [tests/](../tests/) and run in Node with no browser and no database.

| File | Covers |
| --- | --- |
| `kabaddi.test.ts` | Every rule: touch and revival order, bonus allowed and rejected, tackle and super tackle, all outs, do-or-die, raid timeout, timeouts and their reset, scoring blocked at half time and full time, replay and undo |
| `clock.test.ts` | Clock maths |
| `display.test.ts` | Banners, half time at 00:00 before `END_HALF`, `dueAutoEvent` timing |
| `syncQueue.test.ts` | Order, offline then online, survives reload, undo of an unsent op, conflicts, corrupt storage |
| `scorerStore.test.ts` | Optimistic taps, rejected taps, undo, offline reload, auto events firing once |
| `helpers.test.ts` | Event row conversion, settings parsing, team names, clock formatting |
| `seed.test.ts` | `supabase/seed.sql` matches `createInitialState` |
| `simulate.test.ts` | The mock simulator plays a valid full match and is deterministic |

Before handing over a change, run all four checks:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Manual checks

These need a real Supabase project and two devices. They are the acceptance checks from the original brief.

1. **Live updates**: open `/scorer/[id]` on a tablet and `/match/[id]` on a phone. Each tap shows on the phone within about a second.
2. **Offline**: turn off the tablet's network, tap three events, turn it back on. The badge goes from "Not synced (3 pending)" to "Synced", and the phone shows all three in order.
3. **Automatic half time**: start the clock with a short half (create a room with a 1-minute half). At 00:00 every screen shows "Half time" without anyone tapping.
4. **Reload with pending taps**: go offline, tap, reload the control panel. The taps are still shown and sync later.
5. **Ownership**: log in as a second admin and open the first admin's `/scorer/[id]`. It shows 404.
6. **Overlay**: add `/overlay/[id]` to OBS at 1920x1080. The background is transparent.
7. **PWA**: on the Vercel deployment, install the app, open a room, switch to airplane mode and reload. The panel still opens.

In mock mode you can do checks 1, 3, 4 and 6 on one machine with two browser windows.
