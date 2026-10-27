# 07 Auth and admin

Registration, login, route protection, match rooms and the control panel route.

## Concepts

- **Admin**: anyone who registers. There are no roles; every account can create rooms.
- **Room**: a match. The admin who creates it is its `scorer_id` and the only one who can score it.
- The UI says "Admin" and "rooms". The URLs keep the original brief's names: `/scorer` and `/scorer/[id]`.

## Pages and actions

| Route | File | What it does |
| --- | --- | --- |
| `/register` | [src/app/register/page.tsx](../src/app/register/page.tsx) | Email, password (8+), confirm password |
| `/login` | [src/app/login/page.tsx](../src/app/login/page.tsx) | Email and password. In mock mode also a one-click demo login |
| `/auth/callback` | [src/app/auth/callback/route.ts](../src/app/auth/callback/route.ts) | Landing page for the email confirmation link |
| `/scorer` | [src/app/scorer/page.tsx](../src/app/scorer/page.tsx) | My rooms, create form, share links, sign out |
| `/scorer/[id]` | [src/app/scorer/[id]/page.tsx](../src/app/scorer/[id]/page.tsx) | Control panel for one room |

All auth server actions are in [src/app/login/actions.ts](../src/app/login/actions.ts): `signIn`, `signUp`, `signOut`, `signInDemo`.

### Registration and email confirmation

`signUp` behaves according to the Supabase setting **Authentication > Sign In / Providers > Email > Confirm email**:

- Off: Supabase returns a session at once and the admin lands on `/scorer`.
- On: the admin gets "Check your email". The link goes to `/auth/callback`, which exchanges the code for a session and redirects to `/scorer`. Add that URL to Supabase's Redirect URLs.

Supabase's built-in email sends only a few messages per hour. Use custom SMTP if you keep confirmation on.

### Open redirects

`next` parameters are only followed when they start with `/` and not `//`, so a crafted link cannot send someone to another site after login.

## Route protection

Two layers:

1. **[src/proxy.ts](../src/proxy.ts)** runs on `/scorer/*`, `/login` and `/register`. It refreshes the Supabase session cookies and redirects logged-out visitors from `/scorer` to `/login?next=...`. Logged-in visitors on `/login` or `/register` go to `/scorer`.
2. **`requireAdmin()`** in [src/lib/auth.ts](../src/lib/auth.ts) runs in every admin page and action. It reads the user again and redirects to login if needed.

`getRoom()` returns `null` for a room that belongs to someone else, and the page shows 404. RLS blocks writes anyway.

## Data access

[src/lib/adminData.ts](../src/lib/adminData.ts) is the only place admin pages read or write data:

| Function | Supabase | Mock |
| --- | --- | --- |
| `listMyRooms(userId)` | `matches` where `scorer_id = userId` | `mockRoomsFor` |
| `getRoom(id, userId)` | Match row + event log (up to 5000 rows requested) | `mockRoom` |
| `insertRoom(input)` | INSERT with an initial state | `mockCreateRoom` |

## Create room

[src/app/scorer/CreateRoomForm.tsx](../src/app/scorer/CreateRoomForm.tsx) and `createRoom` in [src/app/scorer/actions.ts](../src/app/scorer/actions.ts):

- Team names are trimmed, required, at most 60 characters and must differ.
- The date and time is converted to ISO in the browser, so the admin's time zone is kept. The server would otherwise read it in UTC.
- Optional settings are parsed by `parseSettings`. Empty fields keep the defaults.
- On success it redirects to the new room's control panel.

## Sign out

`SignOutButton` first clears the service worker's page cache (see [09 PWA](09-pwa.md)), then calls `signOut`. A shared device does not keep a copy of the admin's control panel.
