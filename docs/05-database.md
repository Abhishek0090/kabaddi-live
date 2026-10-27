# 05 Database

Supabase Postgres schema, security rules and RPCs. Code: [supabase/schema.sql](../supabase/schema.sql), types: [src/lib/db.types.ts](../src/lib/db.types.ts).

`schema.sql` is idempotent: you can run it again after editing it.

## Tables

### `matches`

One row per match room.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `team_a`, `team_b` | text | 1 to 60 characters |
| `scheduled_at` | timestamptz | From the create form |
| `settings` | jsonb | `Settings` object |
| `state` | jsonb | Latest `MatchState`, written by the RPCs |
| `scorer_id` | uuid | The admin who owns the room. References `auth.users` |
| `status` | text | `scheduled`, `live` or `finished`. Set by the RPCs from `state.phase` |
| `last_seq` | int | Highest event `seq`. Used to reject gaps and spot retries |
| `created_at`, `updated_at` | timestamptz | `updated_at` is set by a trigger |

### `match_events`

The event log. `unique (match_id, seq)`.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | bigserial | |
| `match_id` | uuid | Cascades on match delete |
| `seq` | int | 1, 2, 3 ... per match |
| `type` | text | Event type, for example `TOUCH` |
| `payload` | jsonb | The rest of the event, for example `{ "n": 2, "at": 1761580000000 }` |

Conversion between `MatchEvent` and rows is in [src/lib/events.ts](../src/lib/events.ts).

## Row level security

| Table | Who can | What |
| --- | --- | --- |
| `matches` | Everyone | SELECT |
| `matches` | Logged-in user | INSERT a row where `scorer_id` is themselves |
| `matches` | The room's scorer | UPDATE |
| `match_events` | Everyone | SELECT |
| `match_events` | The room's scorer | INSERT, DELETE |

The browser uses the publishable key, so these policies are the real security boundary.

## RPCs

Both write RPCs are `SECURITY INVOKER`, so the policies above still apply. Both lock the match row with `SELECT ... FOR UPDATE`, which also serialises concurrent calls. They return `'ok'`, or `'duplicate'` when a retry finds the work already done.

### `record_event(p_match, p_seq, p_type, p_payload, p_state)`

- `p_seq = last_seq + 1`: inserts the event, saves the state, updates `last_seq` and `status`.
- `p_seq <= last_seq` and the stored event at that `seq` has the same type and payload: returns `'duplicate'`.
- Anything else: error `KB409`.

### `undo_last_event(p_match, p_seq, p_state)`

- `p_seq = last_seq`: deletes that event, saves the state, `last_seq - 1`.
- `p_seq > last_seq`: already undone, returns `'duplicate'`.
- Anything else: error `KB409`.

`p_seq` is not in the original brief. Without it, a retried undo would delete two events.

### `server_now()`

Returns server time in epoch milliseconds. Callable by everyone.

### Error codes

| Code | Meaning | Client reaction |
| --- | --- | --- |
| `KB404` | Match not found, or the caller is not its scorer | Conflict: stop the queue |
| `KB409` | `seq` out of order | Conflict: stop the queue |
| anything else | Network, auth refresh, server hiccup | Retry in 3 seconds |

## Realtime

`matches` is added to the `supabase_realtime` publication. Public pages subscribe to UPDATEs on one row. `match_events` is not published; nothing needs it live.

## Keeping types in step

`db.types.ts` is written by hand to match `schema.sql`. When you change the schema, update both. You can generate the types instead with the Supabase CLI (`supabase gen types typescript`), but that adds a tool to the workflow.

## Keep-alive

Free projects pause after 7 days without activity. [.github/workflows/keep-supabase-awake.yml](../.github/workflows/keep-supabase-awake.yml) reads one row from `matches` once a day.
