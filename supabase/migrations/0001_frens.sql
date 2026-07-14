-- FRENS Workout — schema, security, RPCs, seed
-- Apply in the Supabase SQL editor (one paste). Safe to re-run.
-- Set your group passcode at the very bottom before running.

create extension if not exists pgcrypto;

-- ============================================================
-- Tables
-- ============================================================
create table if not exists public.members (
  id           uuid primary key default gen_random_uuid(),
  sheet_name   text not null unique,
  user_id      uuid unique references auth.users(id) on delete set null,
  display_name text not null,
  emoji        text,
  color        text,
  is_admin     boolean not null default false,
  created_at   timestamptz not null default now()
);

create table if not exists public.workouts (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references public.members(id) on delete cascade,
  workout_date date not null,
  types        text[],
  duration_min int check (duration_min is null or duration_min > 0),
  note         text check (note is null or length(note) <= 500),
  photo_path   text,
  source       text not null default 'app' check (source in ('app','sheet')),
  logged_at    timestamptz not null default now(),
  unique (member_id, workout_date)
);

create table if not exists public.reactions (
  id         uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  member_id  uuid not null references public.members(id) on delete cascade,
  emoji      text not null default '🔥',
  created_at timestamptz not null default now(),
  unique (workout_id, member_id, emoji)
);

create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  member_id  uuid not null references public.members(id) on delete cascade,
  body       text not null check (length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references public.members(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  key   text primary key,
  value text
);

create index if not exists workouts_date_idx on public.workouts (workout_date);
create index if not exists comments_workout_idx on public.comments (workout_id);
create index if not exists reactions_workout_idx on public.reactions (workout_id);

-- ============================================================
-- Security-definer helpers (bypass RLS → no policy recursion)
-- ============================================================
create or replace function public.my_member_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.members where user_id = auth.uid();
$$;

create or replace function public.is_claimed_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where user_id = auth.uid());
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.members where user_id = auth.uid()), false);
$$;

-- ============================================================
-- Onboarding + admin RPCs (passcode never leaves the DB)
-- ============================================================
create or replace function public.list_unclaimed(passcode text)
returns table (id uuid, sheet_name text, display_name text)
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.settings where key = 'group_passcode' and value = crypt(passcode, value)) then
    raise exception 'bad_passcode';
  end if;
  return query
    select m.id, m.sheet_name, m.display_name
    from public.members m where m.user_id is null
    order by m.display_name;
end; $$;

create or replace function public.claim_member(p_member_id uuid, passcode text)
returns void language plpgsql security definer set search_path = public as $$
declare updated int;
begin
  if not exists (select 1 from public.settings where key = 'group_passcode' and value = crypt(passcode, value)) then
    raise exception 'bad_passcode';
  end if;
  if exists (select 1 from public.members where user_id = auth.uid()) then
    raise exception 'already_claimed_by_you';
  end if;
  update public.members set user_id = auth.uid()
    where id = p_member_id and user_id is null;
  get diagnostics updated = row_count;
  if updated = 0 then raise exception 'name_taken'; end if;
end; $$;

create or replace function public.admin_unclaim(p_member_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  update public.members set user_id = null where id = p_member_id;
end; $$;

create or replace function public.admin_add_member(p_name text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  insert into public.members (sheet_name, display_name) values (p_name, p_name)
  on conflict (sheet_name) do nothing;
end; $$;

-- Only authenticated users may call the RPCs
revoke all on function public.list_unclaimed(text)         from public, anon;
revoke all on function public.claim_member(uuid, text)     from public, anon;
revoke all on function public.admin_unclaim(uuid)          from public, anon;
revoke all on function public.admin_add_member(text)       from public, anon;
grant execute on function public.list_unclaimed(text)      to authenticated;
grant execute on function public.claim_member(uuid, text)  to authenticated;
grant execute on function public.admin_unclaim(uuid)       to authenticated;
grant execute on function public.admin_add_member(text)    to authenticated;

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.members            enable row level security;
alter table public.workouts           enable row level security;
alter table public.reactions          enable row level security;
alter table public.comments           enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.settings           enable row level security;   -- default deny; only RPCs read it

-- members: claimed members can read the roster; writes go through RPCs only
drop policy if exists members_select on public.members;
create policy members_select on public.members
  for select to authenticated using (public.is_claimed_member());

-- workouts: everyone in the club reads; you write only your own, no future dates
drop policy if exists workouts_select on public.workouts;
create policy workouts_select on public.workouts
  for select to authenticated using (public.is_claimed_member());

drop policy if exists workouts_insert on public.workouts;
create policy workouts_insert on public.workouts
  for insert to authenticated
  with check (
    member_id = public.my_member_id()
    and workout_date <= (now() at time zone 'Asia/Kolkata')::date
  );

drop policy if exists workouts_update on public.workouts;
create policy workouts_update on public.workouts
  for update to authenticated
  using (member_id = public.my_member_id())
  with check (
    member_id = public.my_member_id()
    and workout_date <= (now() at time zone 'Asia/Kolkata')::date
  );

drop policy if exists workouts_delete on public.workouts;
create policy workouts_delete on public.workouts
  for delete to authenticated using (member_id = public.my_member_id());

-- reactions
drop policy if exists reactions_select on public.reactions;
create policy reactions_select on public.reactions
  for select to authenticated using (public.is_claimed_member());
drop policy if exists reactions_insert on public.reactions;
create policy reactions_insert on public.reactions
  for insert to authenticated with check (member_id = public.my_member_id());
drop policy if exists reactions_delete on public.reactions;
create policy reactions_delete on public.reactions
  for delete to authenticated using (member_id = public.my_member_id());

-- comments
drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments
  for select to authenticated using (public.is_claimed_member());
drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments
  for insert to authenticated with check (member_id = public.my_member_id());
drop policy if exists comments_delete on public.comments;
create policy comments_delete on public.comments
  for delete to authenticated using (member_id = public.my_member_id());

-- push subscriptions: fully private to their owner
drop policy if exists push_all on public.push_subscriptions;
create policy push_all on public.push_subscriptions
  for all to authenticated
  using (member_id = public.my_member_id())
  with check (member_id = public.my_member_id());

-- ============================================================
-- Realtime
-- ============================================================
do $$ begin
  alter publication supabase_realtime add table public.workouts;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.reactions;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.comments;
exception when duplicate_object then null; end $$;

-- ============================================================
-- Storage: private "proof" bucket, per-user folders
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proof', 'proof', false, 5242880,
  array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists proof_read on storage.objects;
create policy proof_read on storage.objects
  for select to authenticated
  using (bucket_id = 'proof' and public.is_claimed_member());

drop policy if exists proof_write on storage.objects;
create policy proof_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'proof' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists proof_delete on storage.objects;
create policy proof_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'proof' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- Seed: 13 members (Tarang excluded; Radhika added). Chaitanya = admin.
-- ============================================================
insert into public.members (sheet_name, display_name, is_admin) values
  ('Abhimanyu','Abhimanyu',false),
  ('Akshit','Akshit',false),
  ('Bhawna','Bhawna',false),
  ('Chaitanya','Chaitanya',true),
  ('Mugdha','Mugdha',false),
  ('Rahul','Rahul',false),
  ('Saksham','Saksham',false),
  ('Saurabh','Saurabh',false),
  ('Shashwat N.','Shashwat N.',false),
  ('Vareni','Vareni',false),
  ('Shaswat K.','Shaswat K.',false),
  ('Saavy','Saavy',false),
  ('Radhika','Radhika',false)
on conflict (sheet_name) do nothing;

-- ============================================================
-- Group passcode — REPLACE 'CHANGE_ME' with the code you'll share with FRENS.
-- ============================================================
insert into public.settings (key, value)
values ('group_passcode', crypt('CHANGE_ME', gen_salt('bf')))
on conflict (key) do update set value = excluded.value;
