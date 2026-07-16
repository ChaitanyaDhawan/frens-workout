-- FRENS — per-member "mute the group" window for testing auto-log without
-- spamming everyone. While notify_quiet_until is in the future, send-push skips
-- the group ('X just worked out') notification for THIS member's workouts; the
-- logger's own auto-log self-notification still fires. Armed via the log-workout
-- URL's &quiet=<minutes> param; auto-expires. Applied to prod 2026-07-16.

alter table public.members add column if not exists notify_quiet_until timestamptz;
