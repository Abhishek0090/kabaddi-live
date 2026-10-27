# 11 Making changes

Recipes for the changes people ask for most, then what still needs doing before real use.

After any change, run `npm run lint`, `npm run typecheck`, `npm test` and `npm run build`.

## Recipes

### Change a scoring rule

Example: allow a bonus with 5 or more defenders.

1. Edit the constant or the `case` in [src/lib/kabaddi.ts](../src/lib/kabaddi.ts). Thresholds are named constants at the top: `BONUS_MIN_DEFENDERS`, `SUPER_TACKLE_MAX_DEFENDERS`, `DO_OR_DIE_AFTER`, `FEED_LIMIT`.
2. Update or add tests in [tests/kabaddi.test.ts](../tests/kabaddi.test.ts).
3. Update the event table in [03 Rules engine](03-rules-engine.md).

Matches already in progress replay with the new rule the next time someone presses Undo. If an old event is no longer valid under the new rule, undo fails with "Event N (TYPE): ...". Change rules between matches, not during one.

### Add a new event type

Example: a "Technical point" button.

1. [src/lib/kabaddi.types.ts](../src/lib/kabaddi.types.ts): add it to `SimpleEventType`, or add a new member to `MatchEvent` if it carries data.
2. [src/lib/kabaddi.ts](../src/lib/kabaddi.ts): add a `case` in `apply()`. Add it to `SCORING_EVENTS` if it should be blocked at half time, during timeouts and outside raids.
3. [src/lib/events.ts](../src/lib/events.ts): add it to `EVENT_TYPES`, and to `rowToEvent` if it carries data. Without this, saved events of the new type fail to load.
4. [src/lib/format.ts](../src/lib/format.ts): adjust `eventLabel` if the default label ("Technical point") is not right.
5. [src/app/scorer/[id]/ControlPanel.tsx](../src/app/scorer/[id]/ControlPanel.tsx): add a button that calls `tap({ type: "..." })`.
6. Tests in `kabaddi.test.ts` and `helpers.test.ts`.

The database needs no change: `match_events.type` is free text.

### Add a match setting

1. Add the field to `Settings` in `kabaddi.types.ts` and to `DEFAULT_SETTINGS` in `kabaddi.ts`.
2. Add a form field to `SETTING_FIELDS` in [src/lib/settings.ts](../src/lib/settings.ts), and its mapping in `SETTINGS_KEY`.
3. Use it in the engine.
4. Update both JSON blocks in [supabase/seed.sql](../supabase/seed.sql). `seed.test.ts` fails until you do.
5. Rooms created before the change do not have the field. Read it with a fallback, for example `state.settings.newThing ?? DEFAULT_SETTINGS.newThing`.

### Add a database column

1. [supabase/schema.sql](../supabase/schema.sql): add `alter table public.matches add column if not exists ...` so re-running stays safe. Run it in the Supabase SQL Editor.
2. [src/lib/db.types.ts](../src/lib/db.types.ts): add it to the row type, and to `PUBLIC_MATCH_COLUMNS` and `MatchRow` if public pages need it.
3. Mock mode: add it in `newMatch()` in [src/lib/mock/store.ts](../src/lib/mock/store.ts).
4. Write it in `insertRoom()` in [src/lib/adminData.ts](../src/lib/adminData.ts) if it comes from the create form.

### Change colours and styling

- Shared button, input and card styles: [src/components/ui.ts](../src/components/ui.ts).
- Brand colour (orange) and team colours (A orange, B sky blue) are Tailwind classes repeated in these files: `ui.ts`, `MatDots.tsx`, `MatchCard.tsx`, `FeaturedMatch.tsx`, `Logo.tsx`, `AuthForm.tsx`, `app/page.tsx`, `match/[id]/LiveScoreboard.tsx`, `overlay/[id]/Overlay.tsx`, `scorer/page.tsx`, `scorer/[id]/ControlPanel.tsx`, `not-found.tsx`. Search for `orange-` and `sky-`.
- The app icon colour is in [src/lib/appIcon.tsx](../src/lib/appIcon.tsx), and `theme_color` in [src/app/manifest.ts](../src/app/manifest.ts).

### Move or resize the OBS overlay

Edit [src/app/overlay/[id]/Overlay.tsx](../src/app/overlay/[id]/Overlay.tsx). The position is `bottom-[54px] left-[96px]`; sizes are px on a 1920x1080 canvas. Keep it inside the outer 5% so it is title-safe on every TV.

### Rename `/scorer` to `/admin`

1. Rename the folder `src/app/scorer` to `src/app/admin`.
2. [src/proxy.ts](../src/proxy.ts): change the `startsWith("/scorer")` checks and the `matcher`.
3. Search `src/` for `/scorer` and replace it in links and redirects. Today it appears in `login/actions.ts` (default `next`), `auth/callback/route.ts`, `app/page.tsx` ("Score a match"), and inside the renamed folder: `page.tsx`, `actions.ts`, `[id]/page.tsx` and `[id]/ControlPanel.tsx`.
4. Update the README and these docs.

### Change what the service worker caches

Edit [public/sw.js](../public/sw.js) and bump `VERSION`, or installed apps keep the old cache rules.

## Before using it for real matches

| Item | Why |
| --- | --- |
| Turn off `NEXT_PUBLIC_MOCK` | Mock login is not secure and its data is not shared between server instances |
| Run `schema.sql` and test once end to end | The SQL is checked by review, not by an automated database test. Do the manual checks in [10 Testing](10-testing.md) |
| Decide on open registration | Anyone can create an admin account and rooms. For a closed league, turn off "Allow new users to sign up" in Supabase and create admins yourself |
| Set up email if confirmation is on | Supabase's built-in email sends only a few messages an hour |
| Add the GitHub secrets for the keep-alive job | Otherwise the free project pauses after a week without visits |
| Keep the scoring tablet awake | Automatic half time and raid timeout come from the control panel |

## Known limits and possible next steps

| Limit | Possible change |
| --- | --- |
| About 200 concurrent Realtime viewers on Supabase Free | Upgrade the plan, or add polling as a fallback when the channel cannot connect |
| Supabase returns at most 1000 rows per request by default, which caps an event log at 1000 events | A match is normally a few hundred events. For longer logs, page through `getRoom()` or raise "Max rows" in the Supabase API settings |
| One admin per room | Add a `match_scorers` table and change the RLS policies to check it |
| No edit or delete for rooms | Add server actions in `adminData.ts`, plus a DELETE policy on `matches` |
| No player names | Add a roster and let TOUCH and TACKLE carry slot ids. The engine already tracks slots |
| The home page lists at most 300 matches and 30 finished ones | Add paging when that becomes a problem |
| `db.types.ts` is hand-written | Generate it with the Supabase CLI |
| The database trusts the state the scorer's device sends | Acceptable for a room owner. If several scorers are added, consider validating events server-side |
