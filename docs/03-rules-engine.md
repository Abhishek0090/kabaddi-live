# 03 Rules engine

How kabaddi scoring is modelled. Code: [src/lib/kabaddi.ts](../src/lib/kabaddi.ts) and [src/lib/kabaddi.types.ts](../src/lib/kabaddi.types.ts). Tests: [tests/kabaddi.test.ts](../tests/kabaddi.test.ts).

## The contract

```ts
applyEvent(state: MatchState, event: MatchEvent): { ok: true; state } | { ok: false; error: string }
replay(initial: MatchState, events: MatchEvent[]): same result type
createInitialState(teamA, teamB, settings?): MatchState
```

- Pure: no React, no network, no `Date.now()`. Time comes from `event.at`.
- Never mutates its input. It works on a `structuredClone` and returns the copy.
- A rejected event returns a short, human-readable `error`. The control panel shows it inline.

## Settings

Stored per match in `matches.settings` and copied into `state.settings`.

| Setting | Default | Form range |
| --- | --- | --- |
| `playersOnMat` | 7 | 5 to 7 |
| `halfMs` | 20 minutes | 1 to 60 minutes |
| `raidMs` | 30 seconds | 10 to 60 seconds |
| `timeoutsPerHalf` | 2 | 0 to 5 |
| `timeoutMs` | 30 seconds | 10 to 300 seconds |
| `allOutBonus` | 2 | 0 to 5 |

The form ranges live in [src/lib/settings.ts](../src/lib/settings.ts).

## State

| Field | Meaning |
| --- | --- |
| `teams.A`, `teams.B` | `name`, `score`, `mat` (slot numbers on the mat), `outQueue` (slots that are out, oldest first), `timeoutsLeft`, `emptyRaids` (consecutive) |
| `half` | 1 or 2 |
| `phase` | `pre`, `play`, `halftime`, `fulltime` |
| `matchClock` | `{ runningSince, remainingMs }` |
| `raid` | `null`, or `{ clock, doOrDie, bonus }` while a raid is running |
| `raidingTeam` | Team whose turn it is to raid, `null` before the toss |
| `firstRaider` | Team that made the first raid of half 1 |
| `timeout` | `null`, or `{ team, endsAt }` |
| `feed` | Last 20 feed items, newest first |

### Players are anonymous slots

There are no player names. Each team has slots `1..playersOnMat`. When players go out, the highest slots on the mat leave first and join the end of `outQueue`. Revival takes from the front of `outQueue`, so players come back in the order they went out. Only the count is shown in the UI.

## Events

| Event | Allowed when | Effect |
| --- | --- | --- |
| `SET_RAIDING_TEAM` | Not in a break, no raid running | Sets whose turn it is. Used for the toss and to fix mistakes |
| `START_CLOCK` | Not a break, no timeout, clock paused, time left | Phase becomes `play`. Resumes a paused raid clock too |
| `PAUSE_CLOCK` | Phase `play`, clock running | Pauses match and raid clocks |
| `START_RAID` | Not a break, no timeout, no raid, raiding team set, time left | Starts a raid clock; starts the match clock if paused; marks do-or-die |
| `STOP_RAID` | A raid is running | Cancels the raid, no points, same team raids again |
| `TOUCH n` | Scoring allowed, `1 <= n <= defenders on mat` | Raiders +n, n defenders out, raiders revive up to n, raid ends, teams switch |
| `BONUS` | Scoring allowed, 6+ defenders, not already given this raid | Raiders +1. The raid continues |
| `EMPTY_RAID` | Scoring allowed | See empty raids below |
| `TACKLE` | Scoring allowed | Raider out. Defenders +1, or +2 (super tackle) with 3 or fewer defenders. Defenders revive 1 |
| `RAID_TIMEOUT` | Scoring allowed | Like a tackle with +1. Sent automatically when the raid clock runs out |
| `TIMEOUT team` | Phase `play`, no timeout active, team has one left | Pauses clocks, uses one timeout, sets `endsAt` |
| `RESUME` | A timeout is active | Clears it. Clocks stay paused until Start clock or Start raid |
| `END_HALF` | Phase `play` | Stops clocks, cancels raid and timeout. Half 1 goes to `halftime`, half 2 to `fulltime` |
| `START_SECOND_HALF` | Phase `halftime` | Half 2, clock reset, timeouts reset, the team that did not raid first in half 1 raids first |

"Scoring allowed" means: phase is `play`, no timeout is active, and a raid is running. The messages for each case are different, for example "It's half time. Scoring is closed."

### Order of operations for a scoring event

1. Reject if scoring is not allowed.
2. Apply points, players out, and revivals.
3. Update the empty-raid count, end the raid, switch the raiding team.
4. Check for an all out on both teams: a team with 0 on the mat gives the other team `allOutBonus`, and comes back with a full mat and an empty out queue.
5. Add feed items.

### Empty raids and do-or-die

- A plain empty raid adds 1 to the raiding team's `emptyRaids`.
- Any raid that is not empty sets it back to 0, including one where the raider is tackled.
- When `emptyRaids >= 2`, the team's next raid is do-or-die. `START_RAID` records this as `raid.doOrDie`.
- An empty do-or-die raid counts as raider out: defenders +1 and revive 1.
- If the raid already scored a bonus, `EMPTY_RAID` just ends it. It is not counted as empty and there is no do-or-die penalty.
- `emptyRaids` is not reset at half time.

`isDoOrDie(state)` tells the UI whether to show the badge, both during the raid and before it starts.

### Timeouts that run out on their own

If any event other than `RESUME` arrives at or after `timeout.endsAt`, the engine clears the timeout first. So a timeout always ends on time, even if the `RESUME` from the scorer's device never arrived.

## Replay and undo

`replay(initial, events)` applies events in order and stops at the first rejected one, saying which. Undo is `replay(initial, log.slice(0, -1))`. The initial state is rebuilt from the match's team names and settings, so a log is enough to rebuild any match.

If you change a rule, old logs replay with the new rule the next time someone presses Undo on that match. See [11 Making changes](11-making-changes.md#change-a-scoring-rule).
