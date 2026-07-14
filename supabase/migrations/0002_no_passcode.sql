-- FRENS — remove the group passcode. Onboarding is now: sign in with Google → pick your
-- unclaimed name → claimed. Reads still require a claimed membership; claiming a name is
-- open to any signed-in account (private app link + admin un-claim is the safety net).

drop function if exists public.list_unclaimed(text);
drop function if exists public.claim_member(uuid, text);

create or replace function public.list_unclaimed()
returns table (id uuid, sheet_name text, display_name text)
language sql stable security definer set search_path = public as $$
  select id, sheet_name, display_name
  from public.members where user_id is null
  order by display_name;
$$;

create or replace function public.claim_member(p_member_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare updated int;
begin
  if exists (select 1 from public.members where user_id = auth.uid()) then
    raise exception 'already_claimed_by_you';
  end if;
  update public.members set user_id = auth.uid()
    where id = p_member_id and user_id is null;
  get diagnostics updated = row_count;
  if updated = 0 then raise exception 'name_taken'; end if;
end; $$;

revoke all on function public.list_unclaimed()      from public, anon;
revoke all on function public.claim_member(uuid)     from public, anon;
grant execute on function public.list_unclaimed()    to authenticated;
grant execute on function public.claim_member(uuid)  to authenticated;

delete from public.settings where key = 'group_passcode';
