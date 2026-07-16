// FRENS — log-workout Edge Function.
// A device-side ping (Apple Watch → iOS Shortcut) auto-logs today's workout.
// Auth is a per-member secret token (member_log_tokens), NOT a Supabase session,
// so this MUST be deployed with --no-verify-jwt.
//
//   GET/POST  https://<proj>.supabase.co/functions/v1/log-workout?token=<secret>
//   optional  &type=<workout type>&min=<minutes>   (or a JSON body {type, min})
//
// Deploy: supabase functions deploy log-workout --no-verify-jwt

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(SUPABASE_URL, SERVICE_KEY);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};
const reply = (body: string, status = 200) =>
  new Response(body, { status, headers: { ...CORS, "content-type": "text/plain" } });

// Tokens are hex uuids (dashes stripped) — a cheap gate before touching the DB.
const TOKEN_RE = /^[a-f0-9]{16,64}$/i;

// Map common Apple/Strava workout-type names onto the app's activity vocab;
// unknown types pass through (sanitized, title-cased, capped).
const TYPE_MAP: Record<string, string> = {
  running: "Run", run: "Run", "outdoor run": "Run", "indoor run": "Run", jogging: "Run",
  walking: "Walk", walk: "Walk", hiking: "Hike", hike: "Hike",
  cycling: "Cycling", "outdoor cycle": "Cycling", "indoor cycle": "Cycling", biking: "Cycling", ride: "Cycling",
  "traditional strength training": "Gym", "functional strength training": "Gym",
  "strength training": "Gym", "core training": "Gym", "weight training": "Gym", gym: "Gym", lifting: "Gym",
  yoga: "Yoga", pilates: "Pilates", "mind and body": "Yoga",
  swimming: "Swim", "pool swim": "Swim", "open water swim": "Swim", swim: "Swim",
  "high intensity interval training": "HIIT", hiit: "HIIT",
  tennis: "Tennis", badminton: "Badminton", squash: "Squash",
  football: "Football", soccer: "Football", basketball: "Basketball", cricket: "Cricket",
  dance: "Dance", rowing: "Rowing", boxing: "Boxing",
  elliptical: "Cardio", "stair climbing": "Cardio", "stair stepper": "Cardio",
};

function mapType(raw: string | null): string | null {
  if (!raw) return null;
  // strip NUL + other control chars (can't live in a Postgres text column)
  let t = String(raw).replace(/[\x00-\x1F\x7F]/g, "").trim();
  if (!t) return null;
  const m = TYPE_MAP[t.toLowerCase()];
  if (m) return m;
  t = t.slice(0, 40);
  if (/[\uD800-\uDBFF]$/.test(t)) t = t.slice(0, -1); // drop a dangling lone surrogate
  return t.replace(/\b\w/g, (c) => c.toUpperCase());
}

function istToday(): string {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

function toMinutes(minRaw: unknown, secRaw: unknown): number | null {
  if (minRaw != null && String(minRaw).trim() !== "") {
    const n = Math.round(parseFloat(String(minRaw)));
    if (Number.isFinite(n) && n > 0) return Math.min(n, 1440);
  }
  if (secRaw != null && String(secRaw).trim() !== "") {
    const s = parseFloat(String(secRaw));
    if (Number.isFinite(s) && s > 0) return Math.min(Math.max(1, Math.round(s / 60)), 1440);
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return reply("ok");

  const url = new URL(req.url);
  let token = url.searchParams.get("token");
  let type = url.searchParams.get("type") ?? url.searchParams.get("workout");
  let minRaw: unknown = url.searchParams.get("min") ?? url.searchParams.get("minutes") ?? url.searchParams.get("duration");
  let secRaw: unknown = url.searchParams.get("sec") ?? url.searchParams.get("seconds");

  if (req.method === "POST") {
    try {
      const body = await req.json();
      if (body && typeof body === "object") {
        token = token ?? body.token ?? null;
        type = type ?? body.type ?? body.workout ?? null;
        minRaw = minRaw ?? body.min ?? body.minutes ?? body.duration ?? null;
        secRaw = secRaw ?? body.sec ?? body.seconds ?? null;
      }
    } catch {
      /* not JSON — query params only */
    }
  }

  token = token?.trim() || null;
  if (!token) return reply("missing token", 400);
  if (!TOKEN_RE.test(token)) return reply("invalid token", 401);

  const { data: row, error: lookupErr } = await db
    .from("member_log_tokens")
    .select("member_id")
    .eq("token", token)
    .maybeSingle();
  if (lookupErr) {
    console.error("token lookup failed:", lookupErr.message);
    return reply("temporary error — try again", 503);
  }
  if (!row) return reply("invalid token", 401);

  const mappedType = mapType(type);
  const insert: Record<string, unknown> = {
    member_id: row.member_id,
    workout_date: istToday(),
    source: "app",
    types: mappedType ? [mappedType] : [],
  };
  const min = toMinutes(minRaw, secRaw);
  if (min) insert.duration_min = min;

  const { error } = await db.from("workouts").insert(insert);
  if (error) {
    // 23505 = already a workout for today → idempotent success.
    if ((error as { code?: string }).code === "23505") return reply("already logged today ✓");
    console.error("insert failed:", error.message);
    return reply("something went wrong", 500);
  }
  return reply(mappedType ? `logged ${mappedType} ✓` : "logged ✓");
});
