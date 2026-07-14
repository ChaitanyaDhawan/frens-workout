// FRENS — send-push Edge Function.
// Triggered by Supabase Database Webhooks on INSERT into workouts / reactions / comments.
// Fans out Web Push notifications to the right members, minus the actor.
//
// Recipients:
//   workout (source='app' only)  → every claimed member except the logger
//   reaction                     → the workout owner (skip self-likes)
//   comment                      → the workout owner + everyone who already commented
//                                  on that workout, deduped, minus the actor
//
// Deploy:  supabase functions deploy send-push --no-verify-jwt
// Secrets: supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... \
//            VAPID_SUBJECT=mailto:you@example.com WEBHOOK_SECRET=<random>
// Webhooks (Dashboard → Database → Webhooks): one per table (workouts/reactions/comments),
//   event INSERT, type "Supabase Edge Functions" → send-push, add header
//   x-webhook-secret: <same WEBHOOK_SECRET>.

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET')!;

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@frens.app',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
);

const db = createClient(SUPABASE_URL, SERVICE_KEY);

const nameOf = async (memberId: string): Promise<string> => {
  const { data } = await db.from('members').select('display_name').eq('id', memberId).single();
  return data?.display_name ?? 'Someone';
};

// current-quarter workout-day count for a member (IST)
const quarterCount = async (memberId: string): Promise<number> => {
  const now = new Date(Date.now() + 5.5 * 3600 * 1000); // IST
  const q = Math.floor(now.getUTCMonth() / 3);
  const start = new Date(Date.UTC(now.getUTCFullYear(), q * 3, 1)).toISOString().slice(0, 10);
  const { count } = await db.from('workouts')
    .select('id', { count: 'exact', head: true })
    .eq('member_id', memberId).gte('workout_date', start);
  return count ?? 0;
};

const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

async function recipientsAndMessage(table: string, record: any):
  Promise<{ recipients: string[]; title: string; body: string; url: string } | null> {
  if (table === 'workouts') {
    if (record.source !== 'app') return null; // never notify on imported history
    const name = await nameOf(record.member_id);
    const n = await quarterCount(record.member_id);
    const { data: all } = await db.from('members').select('id').not('user_id', 'is', null);
    const recipients = (all ?? []).map(m => m.id).filter(id => id !== record.member_id);
    return { recipients, title: 'FRENS', body: `${name} just worked out 🔥 (${ordinal(n)} this quarter)`, url: '/' };
  }
  if (table === 'reactions') {
    const { data: w } = await db.from('workouts').select('member_id').eq('id', record.workout_id).single();
    if (!w || w.member_id === record.member_id) return null; // no self-like ping
    const name = await nameOf(record.member_id);
    return { recipients: [w.member_id], title: 'FRENS', body: `${name} liked your workout 🔥`, url: '/' };
  }
  if (table === 'comments') {
    const { data: w } = await db.from('workouts').select('member_id').eq('id', record.workout_id).single();
    if (!w) return null;
    const { data: prior } = await db.from('comments').select('member_id').eq('workout_id', record.workout_id);
    const set = new Set<string>([w.member_id, ...(prior ?? []).map(c => c.member_id)]);
    set.delete(record.member_id); // never the actor
    if (!set.size) return null;
    const name = await nameOf(record.member_id);
    const ownerName = await nameOf(w.member_id);
    const isReply = w.member_id !== record.member_id && (prior ?? []).length > 1;
    const body = w.member_id === record.member_id
      ? `${name} commented`
      : isReply ? `${name} replied on ${ownerName}'s workout` : `${name} commented on your workout`;
    return { recipients: [...set], title: 'FRENS', body, url: '/' };
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.headers.get('x-webhook-secret') !== WEBHOOK_SECRET) {
    return new Response('unauthorized', { status: 401 });
  }
  const payload = await req.json();
  const { table, record } = payload;
  const info = await recipientsAndMessage(table, record);
  if (!info || !info.recipients.length) return new Response('no-op', { status: 200 });

  const { data: subs } = await db.from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('member_id', info.recipients);

  const notification = JSON.stringify({ title: info.title, body: info.body, url: info.url });
  await Promise.allSettled((subs ?? []).map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        notification,
      );
    } catch (err: any) {
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await db.from('push_subscriptions').delete().eq('id', s.id); // prune dead endpoint
      }
    }
  }));
  return new Response('sent', { status: 200 });
});
