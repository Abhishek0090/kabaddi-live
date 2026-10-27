# Kabaddi Live Score

A match admin scores a kabaddi match from a tablet or phone, and every tap shows within about a second on a public scoreboard and an OBS stream overlay. It runs on free tiers: Vercel Hobby, Supabase Free, and GitHub Actions.

| Page | Who | What |
| --- | --- | --- |
| `/` | Everyone | Live, upcoming and finished matches |
| `/match/[id]` | Everyone | Big live scoreboard (works as a TV/projector display) |
| `/overlay/[id]` | Everyone | Transparent scorebug for OBS |
| `/register`, `/login` | Admins | Create an admin account, log in |
| `/scorer` | Admin | Your match rooms, create a room, copy share links |
| `/scorer/[id]` | That room's admin | Control panel |

Every match is a room. The admin who creates it is the only one who can score it. The app is installable as a PWA, and the control panel keeps working without a network: taps queue on the device and sync in order when the connection returns.

## Try it without Supabase (mock mode)

Add this to `.env` or `.env.local` and restart `npm run dev`:

```bash
NEXT_PUBLIC_MOCK=true
```

The app then runs on in-memory demo data:

- One demo match plays itself on a loop (8-minute halves), so the home page and scoreboards always have something live.
- Log in as the demo admin (`demo@kabaddi.app` / `kabaddi123`, or the one-click button on `/login`). The demo admin has rooms to score, and registering new admins works too.
- Scoreboards and the overlay poll every second instead of using Supabase Realtime, so a tap on the control panel still shows on other devices on your network.
- Everything resets when the server restarts. Mock login is not secure, so never turn this on for a real deployment.

## 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com) (Free plan).
2. Open **SQL Editor > New query**, paste [supabase/schema.sql](supabase/schema.sql), and click **Run**. It's safe to run again later.
3. Open **Authentication > Sign In / Providers > Email**:
   - Leave **Allow new users to sign up** on, so admins can register.
   - Decide on **Confirm email**:
     - **Off** (simplest): new admins are logged in right after registering. Anyone can create an admin account, but they can only see and score their own rooms.
     - **On**: new admins must click a link in an email first. Supabase's built-in email only sends a few emails per hour and is meant for testing. For real use, set up custom SMTP under **Authentication > Emails > SMTP Settings** (for example, Resend's free tier).
4. Open **Authentication > URL Configuration**:
   - **Site URL**: your Vercel URL, for example `https://kabaddi.vercel.app` (use `http://localhost:3000` until you deploy).
   - **Redirect URLs**: add `http://localhost:3000/auth/callback` and `https://<your-vercel-domain>/auth/callback`.
5. Open **Project Settings > API Keys** and copy the **Project URL** and the **publishable key** (`sb_publishable_...`). Never put the secret key in this app.

### Optional: demo match

Register an admin account first (step 3 of local development below). Then edit the email in [supabase/seed.sql](supabase/seed.sql) to match it, and run the file in the SQL Editor.

## 2. Local development

Needs Node.js 20.9 or newer.

1. Copy `.env.example` to `.env.local` and fill in both values:

   ```bash
   SUPABASE_URL=https://your-project-ref.supabase.co
   SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```

2. Install and run:

   ```bash
   npm install
   npm run dev
   ```

3. Open <http://localhost:3000/register>, create an admin account, and create a room.

Checks:

```bash
npm run lint        # ESLint
npm run typecheck   # route types + tsc
npm test            # Vitest: rules engine, sync queue, display logic
npm run build       # production build
```

To try the control panel on a tablet on the same Wi-Fi, open `http://<your-computer's-IP>:3000`. Logging in over a LAN IP works, but the PWA install and offline mode need HTTPS, so test those on the Vercel deployment.

## 3. Deploy to Vercel

1. Push the repo to GitHub.
2. In Vercel: **Add New > Project**, import the repo, keep the Next.js defaults.
3. Under **Environment Variables**, add `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` for all environments. They are read at build time, so redeploy after changing them.
4. Deploy. Then put the Vercel URL into Supabase's **Site URL** and **Redirect URLs** (section 1, step 4).

Vercel Hobby is for non-commercial use only. If your matches carry sponsors or paid streams, use a paid plan.

## 4. Keep Supabase awake

Free Supabase projects pause after 7 days without activity. [.github/workflows/keep-supabase-awake.yml](.github/workflows/keep-supabase-awake.yml) reads one row from `matches` every day to prevent that.

In GitHub: **Settings > Secrets and variables > Actions > New repository secret**, and add:

- `SUPABASE_URL`: the Project URL
- `SUPABASE_PUBLISHABLE_KEY`: the publishable key

Run it once from the **Actions** tab to check it works. GitHub turns off scheduled workflows in public repos after 60 days without commits. If that happens, re-enable it in the Actions tab.

## 5. OBS overlay

1. In **My rooms**, click **Copy OBS overlay link** for the match.
2. In OBS: **Sources > + > Browser**, paste the link as the URL, and set **Width 1920**, **Height 1080**.
3. Leave the custom CSS empty. The page is already transparent.

The scorebug sits in the bottom-left corner, inside the title-safe area. It shows "Reconnecting..." if it loses its live connection, so you'll see it on the preview before viewers notice.

## 6. Scoring

- Pick who raids first (the toss winner) before the first raid. After each raid, the other team is selected automatically.
- **Start raid** starts the 30-second raid clock, and the match clock if it was paused. Then tap the result: **Touch 1-7**, **Bonus** (then a Touch or **Empty raid**), **Empty raid**, or **Raider tackled**.
- All outs, super tackles, do-or-die raids, revivals, raid timeouts and the end of each half happen automatically.
- **Undo** removes the last event. **Undo** and **End half** ask for confirmation. Everything else is one tap.
- The badge in the top bar shows **Synced**, or **Not synced (n pending)** while taps are queued. Leave the page open until it says Synced.
- The control panel's device ends the half and raids when their clocks run out. Keep it awake (turn off auto-lock) during a match. Public screens also show "Half time" as soon as their clock reaches 00:00.

## Free-tier limits

- Supabase Realtime allows about 200 viewers connected at once on the Free plan. Viewers past that get fresh data when they refocus the page, but no live updates.
- 2 million Realtime messages a month. One update sent to 200 viewers counts as 200 messages.
- 500 MB database. Each match uses a few hundred KB at most.

## Project layout

```text
src/lib/kabaddi.ts       rules engine (pure, fully tested)
src/lib/syncQueue.ts     offline queue: ordered, persisted, retried every 3 s
src/lib/scorerStore.ts   control panel state: optimistic taps, undo, clock expiry
src/lib/display.ts       what every screen shows at a given time
src/lib/useLiveMatch.ts  realtime subscription with refetch on reconnect/focus
src/proxy.ts             session refresh and /scorer login guard
supabase/schema.sql      tables, row level security, RPCs, realtime
public/sw.js             service worker (offline pages and assets)
```

## Developer docs

How the code works, and step-by-step recipes for changing it, are in [docs/](docs/README.md).

## Sharing the code to another machine

`npm run share` writes self-extracting setup and update scripts to `kabaddi-share/`. See `kabaddi-share/HOW-TO-SETUP.md` after running it.
