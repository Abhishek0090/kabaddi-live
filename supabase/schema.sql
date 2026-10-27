-- Kabaddi Live Score schema.
-- Run in Supabase: SQL Editor > New query > paste this file > Run.
-- Safe to run again: every statement is idempotent.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.matches (
  id           uuid primary key default gen_random_uuid(),
  team_a       text not null check (char_length(team_a) between 1 and 60),
  team_b       text not null check (char_length(team_b) between 1 and 60),
  scheduled_at timestamptz,
  settings     jsonb not null check (jsonb_typeof(settings) = 'object'),
  state        jsonb not null check (jsonb_typeof(state) = 'object'),
  scorer_id    uuid not null default auth.uid() references auth.users (id),
  status       text not null default 'scheduled'
               check (status in ('scheduled', 'live', 'finished')),
  -- Highest seq in match_events. Lets record_event reject gaps and retries cheaply.
  last_seq     int not null default 0 check (last_seq >= 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists matches_scorer_id_idx on public.matches (scorer_id);
create index if not exists matches_status_scheduled_idx on public.matches (status, scheduled_at);

create table if not exists public.match_events (
  id         bigserial primary key,
  match_id   uuid not null references public.matches (id) on delete cascade,
  seq        int not null check (seq > 0),
  type       text not null,
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (match_id, seq)
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists matches_touch_updated_at on public.matches;
create trigger matches_touch_updated_at
  before update on public.matches
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.matches enable row level security;
alter table public.match_events enable row level security;

drop policy if exists "Matches are public" on public.matches;
create policy "Matches are public"
  on public.matches for select
  using (true);

drop policy if exists "Scorers create their own matches" on public.matches;
create policy "Scorers create their own matches"
  on public.matches for insert to authenticated
  with check (scorer_id = (select auth.uid()));

drop policy if exists "Scorer updates their match" on public.matches;
create policy "Scorer updates their match"
  on public.matches for update to authenticated
  using (scorer_id = (select auth.uid()))
  with check (scorer_id = (select auth.uid()));

drop policy if exists "Events are public" on public.match_events;
create policy "Events are public"
  on public.match_events for select
  using (true);

drop policy if exists "Scorer adds events" on public.match_events;
create policy "Scorer adds events"
  on public.match_events for insert to authenticated
  with check (exists (
    select 1 from public.matches m
    where m.id = match_id and m.scorer_id = (select auth.uid())
  ));

drop policy if exists "Scorer deletes events" on public.match_events;
create policy "Scorer deletes events"
  on public.match_events for delete to authenticated
  using (exists (
    select 1 from public.matches m
    where m.id = match_id and m.scorer_id = (select auth.uid())
  ));

-- ---------------------------------------------------------------------------
-- RPCs
-- Errors use custom SQLSTATEs so the client can tell them apart:
--   KB404 match not found, or not yours (RLS hides it)
--   KB409 seq is not the next one expected
-- Both RPCs return 'ok', or 'duplicate' when a retry finds the work already done.
-- ---------------------------------------------------------------------------

create or replace function public.match_status(p_state jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_state ->> 'phase'
    when 'pre' then 'scheduled'
    when 'fulltime' then 'finished'
    else 'live'
  end;
$$;

create or replace function public.record_event(
  p_match   uuid,
  p_seq     int,
  p_type    text,
  p_payload jsonb,
  p_state   jsonb
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_last int;
  v_type text;
  v_payload jsonb;
begin
  -- FOR UPDATE applies the UPDATE policy, so only the match's scorer gets a row.
  -- It also serialises concurrent calls for the same match.
  select last_seq into v_last
  from public.matches
  where id = p_match
  for update;

  if not found then
    raise exception 'Match not found, or you are not its scorer.' using errcode = 'KB404';
  end if;

  if p_seq = v_last + 1 then
    insert into public.match_events (match_id, seq, type, payload)
    values (p_match, p_seq, p_type, coalesce(p_payload, '{}'::jsonb));

    update public.matches
    set state = p_state,
        last_seq = p_seq,
        status = public.match_status(p_state)
    where id = p_match;

    return 'ok';
  end if;

  -- A retry after a lost response: the same event is already stored.
  if p_seq <= v_last then
    select type, payload into v_type, v_payload
    from public.match_events
    where match_id = p_match and seq = p_seq;

    if found and v_type = p_type and v_payload = coalesce(p_payload, '{}'::jsonb) then
      return 'duplicate';
    end if;
  end if;

  raise exception 'Expected event % but got %.', v_last + 1, p_seq using errcode = 'KB409';
end;
$$;

create or replace function public.undo_last_event(
  p_match uuid,
  p_seq   int,
  p_state jsonb
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_last int;
begin
  select last_seq into v_last
  from public.matches
  where id = p_match
  for update;

  if not found then
    raise exception 'Match not found, or you are not its scorer.' using errcode = 'KB404';
  end if;

  -- A retry after a lost response: that event is already gone.
  if p_seq > v_last then
    return 'duplicate';
  end if;

  if p_seq <> v_last then
    raise exception 'Only the last event (%) can be undone, not %.', v_last, p_seq using errcode = 'KB409';
  end if;

  delete from public.match_events
  where match_id = p_match and seq = p_seq;

  update public.matches
  set state = p_state,
      last_seq = p_seq - 1,
      status = public.match_status(p_state)
  where id = p_match;

  return 'ok';
end;
$$;

-- Server time in epoch ms. Clients use it to correct their own clock, so every
-- screen shows the same match clock.
create or replace function public.server_now()
returns bigint
language sql
volatile
set search_path = ''
as $$
  select (extract(epoch from clock_timestamp()) * 1000)::bigint;
$$;

revoke execute on function public.record_event(uuid, int, text, jsonb, jsonb) from public, anon;
revoke execute on function public.undo_last_event(uuid, int, jsonb) from public, anon;
grant execute on function public.record_event(uuid, int, text, jsonb, jsonb) to authenticated;
grant execute on function public.undo_last_event(uuid, int, jsonb) to authenticated;
grant execute on function public.server_now() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: public pages subscribe to UPDATEs on matches
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'matches'
  ) then
    alter publication supabase_realtime add table public.matches;
  end if;
end;
$$;
