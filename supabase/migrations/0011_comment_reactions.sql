-- FRENS Workout — comment reactions (iMessage-style tapbacks)
-- One reaction per member per comment (changing your emoji replaces it), shown
-- as overlapping bubbles on the comment card in the thread sheet. Safe to re-run.

create table if not exists public.comment_reactions (
  id         uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments(id) on delete cascade,
  member_id  uuid not null references public.members(id) on delete cascade,
  emoji      text not null check (length(emoji) between 1 and 8),
  created_at timestamptz not null default now(),
  unique (comment_id, member_id)
);

create index if not exists comment_reactions_comment_idx
  on public.comment_reactions (comment_id);

alter table public.comment_reactions enable row level security;

-- Everyone in the club sees reactions; you add/change/remove only your own.
drop policy if exists comment_reactions_select on public.comment_reactions;
create policy comment_reactions_select on public.comment_reactions
  for select to authenticated using (public.is_claimed_member());

drop policy if exists comment_reactions_insert on public.comment_reactions;
create policy comment_reactions_insert on public.comment_reactions
  for insert to authenticated with check (member_id = public.my_member_id());

drop policy if exists comment_reactions_update on public.comment_reactions;
create policy comment_reactions_update on public.comment_reactions
  for update to authenticated
  using (member_id = public.my_member_id())
  with check (member_id = public.my_member_id());

drop policy if exists comment_reactions_delete on public.comment_reactions;
create policy comment_reactions_delete on public.comment_reactions
  for delete to authenticated using (member_id = public.my_member_id());

-- Live bubbles for everyone with the thread open.
do $$ begin
  alter publication supabase_realtime add table public.comment_reactions;
exception when duplicate_object then null; end $$;

-- Push: the comment's author hears about the first reaction (emoji changes
-- stay quiet — INSERT only, matching the other tables' triggers).
drop trigger if exists push_on_comment_reaction on public.comment_reactions;
create trigger push_on_comment_reaction after insert on public.comment_reactions
  for each row execute function public.notify_push();
