-- FRENS — database webhooks that fire the send-push Edge Function on new
-- workouts / kudos / comments. The shared webhook secret lives in settings
-- (default-deny, readable only by this SECURITY DEFINER function), so it is
-- never in this file. Insert it separately:
--   insert into settings(key,value) values ('webhook_secret','<secret>')
--     on conflict (key) do update set value = excluded.value;

create extension if not exists pg_net;

create or replace function public.notify_push()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare secret text;
begin
  select value into secret from public.settings where key = 'webhook_secret';
  if secret is null then return NEW; end if;
  perform net.http_post(
    url := 'https://guyrxmiltskqdrfkfjie.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', secret),
    body := jsonb_build_object('type', TG_OP, 'table', TG_TABLE_NAME, 'record', to_jsonb(NEW))
  );
  return NEW;
end $$;

drop trigger if exists push_on_workout on public.workouts;
create trigger push_on_workout after insert on public.workouts
  for each row when (NEW.source = 'app') execute function public.notify_push();

drop trigger if exists push_on_reaction on public.reactions;
create trigger push_on_reaction after insert on public.reactions
  for each row execute function public.notify_push();

drop trigger if exists push_on_comment on public.comments;
create trigger push_on_comment after insert on public.comments
  for each row execute function public.notify_push();
