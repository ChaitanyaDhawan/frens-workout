-- FRENS — allow source='auto' for device auto-logs (Apple Watch → Shortcut →
-- log-workout Edge Function). Distinguished from 'app' (in-app logs) so the
-- push webhook can also send the logger a "workout auto-logged" self-notification
-- while still notifying everyone else. Applied to prod 2026-07-16.

alter table public.workouts drop constraint if exists workouts_source_check;
alter table public.workouts
  add constraint workouts_source_check check (source in ('app', 'sheet', 'auto'));
