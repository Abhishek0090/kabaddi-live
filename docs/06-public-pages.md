# 06 Public pages

The home page, the big scoreboard and the OBS overlay, and how they stay live.

## Data loading

[src/lib/matches.ts](../src/lib/matches.ts) holds the server-side reads:

- `getMatch(id)` returns one public row. It is wrapped in React `cache()`, so `generateMetadata` and the page share one query.
- `listMatches()` returns `{ live, upcoming, finished }`, or `null` when neither Supabase nor mock mode is configured. Upcoming is sorted by date; finished shows the latest 30.

Both call `connection()` so the pages render per request and never get frozen at build time. Public reads use an anonymous Supabase client with no cookies.

Public pages only read these columns: `id, team_a, team_b, scheduled_at, status, state, updated_at` (`PUBLIC_MATCH_COLUMNS`).

## Live updates: `useLiveMatch`

[src/lib/useLiveMatch.ts](../src/lib/useLiveMatch.ts) takes the server-rendered row and keeps it fresh.

| Mode | How |
| --- | --- |
| Supabase | Subscribes to `postgres_changes` UPDATE on `matches` filtered by id |
| Mock | Polls `/api/mock/matches/[id]` every second |

It also refetches whenever updates might have been missed: after (re)subscribing, on window focus, when the tab becomes visible, and when the network returns. Realtime does not replay missed changes, so this matters.

It keeps whichever copy has the newer `updated_at`, so a slow refetch cannot overwrite a newer realtime update.

The returned `status` drives the connection badge: "Connecting...", "Live" or "Reconnecting...".

## What a screen shows: `matchView`

[src/lib/display.ts](../src/lib/display.ts) turns `(state, now)` into everything a screen needs: match clock, raid clock, do-or-die flag and one banner.

Banner priority:

1. Full time, with the result
2. Half time, with the score
3. Timeout, with a countdown
4. Match not started
5. Clock paused

If the match clock has reached 0 but `END_HALF` has not arrived yet, `matchView` already reports `halftime` or `fulltime`. Every screen switches at 00:00 even if the scorer's tablet is asleep.

`now` is `null` before the first client tick. The view then shows the stored clock values, so server and client HTML match.

## Pages

### Home `/`

[src/app/page.tsx](../src/app/page.tsx):

- Hero with headline, live count and calls to action. The court lines and glow are decoration.
- `FeaturedMatch` ([src/components/FeaturedMatch.tsx](../src/components/FeaturedMatch.tsx)) is a live mini scoreboard of the first live match, or else the next upcoming one, or else the latest finished one.
- Match sections use `MatchCard`. Cards are not live; only the featured card is, to keep Realtime connections low.
- "How it works" and the footer.
- With no data source configured, a setup card replaces the match sections.

### Scoreboard `/match/[id]`

[src/app/match/[id]/LiveScoreboard.tsx](../src/app/match/[id]/LiveScoreboard.tsx). Built to be read from a distance:

- Scores use viewport units: `min(30vw, 36vh)` on phones and `min(20vw, 42vh)` on large screens.
- Two team columns side by side on every screen size. On large screens the clock sits between them; on phones it goes below.
- Banner strip, raid clock, do-or-die badge, players on mat, timeouts left, last 5 events.
- Light and dark mode follow the device.

`generateMetadata` sets the title to the score line, for example "Tigers 12 - 9 Lions", so shared links preview the score.

### Overlay `/overlay/[id]`

[src/app/overlay/[id]/Overlay.tsx](../src/app/overlay/[id]/Overlay.tsx). A scorebug for an OBS Browser Source at 1920x1080:

- Sizes in px, since OBS renders a fixed canvas.
- Placed at `bottom: 54px; left: 96px`, inside the 5% title-safe area.
- An inline `<style>` makes `html` and `body` transparent.
- Shows "Reconnecting..." only when the connection drops, so the stream operator sees it in preview.
