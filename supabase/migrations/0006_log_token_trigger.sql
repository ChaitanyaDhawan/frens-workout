-- 0006_log_token_trigger.sql — auto-create a log token for any NEW member.
-- 0005 seeded tokens once; without this, a member added later (e.g. via
-- admin_add_member) would have no token row and could never auto-log.

create or replace function public.seed_log_token()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.member_log_tokens (member_id)
    values (new.id)
    on conflict (member_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_seed_log_token on public.members;
create trigger trg_seed_log_token
  after insert on public.members
  for each row execute function public.seed_log_token();

-- Backfill any existing member missing a token (idempotent).
insert into public.member_log_tokens (member_id)
  select id from public.members
  on conflict (member_id) do nothing;
