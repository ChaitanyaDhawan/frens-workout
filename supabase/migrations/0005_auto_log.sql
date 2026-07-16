-- 0005_auto_log.sql — per-member secret token for device auto-logging.
--
-- An iOS Shortcut on a fren's phone pings the `log-workout` Edge Function when
-- an Apple Watch workout ends; the token in the URL says who it is (there's no
-- Supabase session on that request). Kept in its OWN table, not a column on
-- members, so RLS can restrict each member to reading ONLY their own token —
-- a plain members column would be readable by every claimed member.

create extension if not exists pgcrypto;

create table if not exists public.member_log_tokens (
  member_id  uuid primary key references public.members(id) on delete cascade,
  token      text unique not null default replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now()
);

alter table public.member_log_tokens enable row level security;

-- A claimed member may read ONLY their own token row (to show it in the app).
-- No insert/update/delete for authenticated; the Edge Function uses the
-- service role (bypasses RLS) to look a member up by token.
drop policy if exists own_log_token on public.member_log_tokens;
create policy own_log_token on public.member_log_tokens
  for select to authenticated
  using (member_id = public.my_member_id());

-- Seed a token for every existing member.
insert into public.member_log_tokens (member_id)
  select id from public.members
  on conflict (member_id) do nothing;
