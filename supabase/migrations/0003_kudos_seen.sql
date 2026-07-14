-- FRENS — "collect your kudos on open": track when each member last saw their kudos,
-- so opening the app can celebrate kudos received since then (once, across devices).

alter table public.members
  add column if not exists kudos_seen_at timestamptz not null default now();

-- Caller marks their own kudos as seen (members has no client UPDATE policy, so use an RPC).
create or replace function public.mark_kudos_seen()
returns void language sql security definer set search_path = public as $$
  update public.members set kudos_seen_at = now() where user_id = auth.uid();
$$;

revoke all on function public.mark_kudos_seen() from public, anon;
grant execute on function public.mark_kudos_seen() to authenticated;
