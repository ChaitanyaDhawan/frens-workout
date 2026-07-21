-- FRENS Workout — per-member timezone
-- Some FRENS live outside India now, so a single hardcoded IST day breaks
-- late-night crediting and shows everyone Indian clock times. Each member row
-- carries an IANA timezone (written by the app from the browser); streaks and
-- auto-logs compute "today" in the member's own zone. Safe to re-run.

alter table public.members
  add column if not exists timezone text not null default 'Asia/Kolkata';

-- Seed the members known to be in the US (confirmed by the group), so their
-- streaks and Apple-Watch auto-logs are computed in the right zone even before
-- they next open the app (the app self-corrects the value on every open).
update public.members set timezone = 'America/New_York'    where sheet_name = 'Abhimanyu';
update public.members set timezone = 'America/Los_Angeles' where sheet_name = 'Mugdha';

-- The app calls this after sign-in whenever the browser's zone differs from the
-- stored one. Validated against pg_timezone_names so junk can't land.
create or replace function public.set_my_timezone(tz text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from pg_timezone_names where name = tz) then
    raise exception 'bad_timezone';
  end if;
  update public.members set timezone = tz where user_id = auth.uid();
end; $$;

revoke all on function public.set_my_timezone(text) from public, anon;
grant execute on function public.set_my_timezone(text) to authenticated;

-- The no-future-dates check was pinned to the IST day, which would reject a
-- legitimate "today" from any zone ahead of IST (a fren travelling in SE Asia /
-- Australia). Cap at UTC+14 — the furthest real local date on Earth — which
-- still blocks genuinely future dates.
drop policy if exists workouts_insert on public.workouts;
create policy workouts_insert on public.workouts
  for insert to authenticated
  with check (
    member_id = public.my_member_id()
    and workout_date <= ((now() at time zone 'utc') + interval '14 hours')::date
  );

drop policy if exists workouts_update on public.workouts;
create policy workouts_update on public.workouts
  for update to authenticated
  using (member_id = public.my_member_id())
  with check (
    member_id = public.my_member_id()
    and workout_date <= ((now() at time zone 'utc') + interval '14 hours')::date
  );
