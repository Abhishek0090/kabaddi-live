-- One demo match, assigned to an existing scorer.
-- 1. Create the scorer user first (Authentication > Users > Add user).
-- 2. Replace scorer@example.com below with that user's email.
-- 3. SQL Editor > New query > paste this file > Run.
--
-- The settings and state below must match createInitialState("Tigers", "Lions")
-- in src/lib/kabaddi.ts. tests/seed.test.ts checks this.

do $seed$
declare
  v_scorer uuid;
begin
  select id into v_scorer from auth.users where email = 'scorer@example.com';

  if v_scorer is null then
    raise exception 'No user with that email. Create the scorer user, then edit the email in seed.sql.';
  end if;

  insert into public.matches (team_a, team_b, scheduled_at, settings, state, scorer_id, status)
  values (
    'Tigers',
    'Lions',
    now() + interval '1 day',
    $settings${"playersOnMat":7,"halfMs":1200000,"raidMs":30000,"timeoutsPerHalf":2,"timeoutMs":30000,"allOutBonus":2}$settings$::jsonb,
    $state${"settings":{"playersOnMat":7,"halfMs":1200000,"raidMs":30000,"timeoutsPerHalf":2,"timeoutMs":30000,"allOutBonus":2},"teams":{"A":{"name":"Tigers","score":0,"mat":[1,2,3,4,5,6,7],"outQueue":[],"timeoutsLeft":2,"emptyRaids":0},"B":{"name":"Lions","score":0,"mat":[1,2,3,4,5,6,7],"outQueue":[],"timeoutsLeft":2,"emptyRaids":0}},"half":1,"phase":"pre","matchClock":{"runningSince":null,"remainingMs":1200000},"raid":null,"raidingTeam":null,"firstRaider":null,"timeout":null,"feed":[]}$state$::jsonb,
    v_scorer,
    'scheduled'
  );
end;
$seed$;
