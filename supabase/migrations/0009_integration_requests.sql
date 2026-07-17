-- FRENS Workout — integration requests ("bring it sooner" votes)
-- Each fren can ask for an auto-log source that isn't live yet (Strava, Fitbit,
-- Google Fit, Garmin, Whoop). Everyone can see who's already asked, so the group
-- sees which integration to build next. Apply in the Supabase SQL editor (one
-- paste). Safe to re-run.

create table if not exists public.integration_requests (
  id         uuid primary key default gen_random_uuid(),
  source     text not null check (source in ('strava','fitbit','google','garmin','whoop')),
  member_id  uuid not null references public.members(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (source, member_id)
);

create index if not exists integration_requests_source_idx
  on public.integration_requests (source);

alter table public.integration_requests enable row level security;

-- Everyone in the club can see the demand; you add/remove only your own vote.
drop policy if exists integration_requests_select on public.integration_requests;
create policy integration_requests_select on public.integration_requests
  for select to authenticated using (public.is_claimed_member());

drop policy if exists integration_requests_insert on public.integration_requests;
create policy integration_requests_insert on public.integration_requests
  for insert to authenticated with check (member_id = public.my_member_id());

drop policy if exists integration_requests_delete on public.integration_requests;
create policy integration_requests_delete on public.integration_requests
  for delete to authenticated using (member_id = public.my_member_id());

-- Realtime so a new vote lights up the count for everyone live.
do $$ begin
  alter publication supabase_realtime add table public.integration_requests;
exception when duplicate_object then null; end $$;
