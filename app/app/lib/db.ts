// Live-data layer: fetches the FRENS Supabase tables and folds them into the
// exact view-model shapes the UI already consumes (Member / FeedItem /
// WorkoutDetail + the day-of-year set). Nothing here touches React or the DOM.

import type { SupabaseClient } from "@supabase/supabase-js";
import { IST_YEAR, TODAY_DOY, type FeedItem, type Member, type QuarterKey, type WorkoutDetail } from "./data";
import { nth } from "./helpers";

// ---- Raw row shapes ----
export interface DbMember {
  id: string;
  sheet_name: string;
  user_id: string | null;
  display_name: string;
  is_admin: boolean;
}
export interface DbWorkout {
  id: string;
  member_id: string;
  workout_date: string; // YYYY-MM-DD (IST calendar date)
  types: string[] | null;
  duration_min: number | null;
  note: string | null;
  photo_path: string | null;
  source: "app" | "sheet";
  logged_at: string; // timestamptz ISO
}
export interface DbReaction {
  id: string;
  workout_id: string;
  member_id: string;
  emoji: string;
}
export interface DbComment {
  id: string;
  workout_id: string;
  member_id: string;
  body: string;
  created_at: string;
}

export interface RawData {
  members: DbMember[];
  workouts: DbWorkout[];
  reactions: DbReaction[];
  comments: DbComment[];
}

// ---- Date helpers (IST) ----
const IST_TZ = "Asia/Kolkata";
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function parseDate(d: string): { y: number; m: number; d: number } {
  const [y, m, day] = d.split("-").map(Number);
  return { y, m: m - 1, d: day };
}
export function dayOfYear(y: number, m0: number, d: number): number {
  return Math.floor((Date.UTC(y, m0, d) - Date.UTC(y, 0, 1)) / 86400000) + 1;
}
export function doyOfDate(iso: string): number {
  const { y, m, d } = parseDate(iso);
  return dayOfYear(y, m, d);
}
function quarterOf(m0: number): QuarterKey | null {
  return m0 < 3 ? "q1" : m0 < 6 ? "q2" : m0 < 9 ? "q3" : null;
}
/** "Mar 30" style label from an ISO date. */
export function lastLabel(iso: string): string {
  const { m, d } = parseDate(iso);
  return `${MON[m]} ${d}`;
}

function istParts(dt: Date): { y: number; m: number; d: number } {
  const s = new Intl.DateTimeFormat("en-CA", { timeZone: IST_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(dt);
  const [y, m, d] = s.split("-").map(Number);
  return { y, m: m - 1, d };
}
function istTime(dt: Date): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: IST_TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(dt);
}

/** Feed timestamp label ("Today · 07:02", "Yesterday · …", "Sunday · …", "Jul 9 · …"). */
export function feedTime(loggedAt: string): string {
  const dt = new Date(loggedAt);
  const p = istParts(dt);
  const doy = dayOfYear(p.y, p.m, p.d);
  const time = istTime(dt);
  if (p.y === IST_YEAR && doy === TODAY_DOY) return `Today · ${time}`;
  if (p.y === IST_YEAR && doy === TODAY_DOY - 1) return `Yesterday · ${time}`;
  if (p.y === IST_YEAR && doy < TODAY_DOY && doy >= TODAY_DOY - 6) {
    const dow = DOW[new Date(Date.UTC(p.y, p.m, p.d)).getUTCDay()];
    return `${dow} · ${time}`;
  }
  return `${MON[p.m]} ${p.d} · ${time}`;
}

// ---- Duration <-> label mapping (the sheet offers 30/45/60/90+) ----
export function minutesToLabel(min: number | null): string | null {
  if (min == null) return null;
  if (min === 30) return "30 min";
  if (min === 45) return "45 min";
  if (min === 60) return "60 min";
  if (min >= 90) return "90+";
  return `${min} min`;
}
export function labelToMinutes(label: string | null): number | null {
  if (!label) return null;
  if (label === "90+") return 90;
  const n = parseInt(label, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function streakFromDoys(doys: Set<number>, todayDoy: number): number {
  let s = 0;
  let d = doys.has(todayDoy) ? todayDoy : todayDoy - 1;
  while (doys.has(d)) {
    s++;
    d--;
  }
  return s;
}

/** Feed brag line, mirroring helpers.bragFor but with the workout's historical ordinal. */
function bragForWorkout(m: Member, qCount: number, yrCount: number, isLatest: boolean): string {
  if (isLatest && m.streak > 1) return `${m.streak}-day streak 🔥`;
  if (yrCount > 2 * qCount && yrCount >= 20) return `${nth(yrCount)} in 2026`;
  return `${nth(qCount)} this quarter`;
}

export interface Aggregate {
  frens: Member[];
  meName: string;
  doneDoy: Set<number>;
  dayData: Record<number, WorkoutDetail>;
  feed: FeedItem[];
}

/** Fold the raw tables into the UI view-model for the signed-in member. */
export function aggregate(raw: RawData, myMemberId: string | null): Aggregate {
  const { members, workouts, reactions, comments } = raw;

  const wByMember = new Map<string, DbWorkout[]>();
  for (const w of workouts) {
    const arr = wByMember.get(w.member_id);
    if (arr) arr.push(w);
    else wByMember.set(w.member_id, [w]);
  }

  // Reaction / comment counts. `likeCount` excludes my own reaction so the feed
  // card can add my optimistic +1 on top (matching the mock's arithmetic).
  const likeCount = new Map<string, number>();
  const myLiked = new Set<string>();
  for (const r of reactions) {
    if (r.emoji !== "🔥") continue;
    if (myMemberId && r.member_id === myMemberId) myLiked.add(r.workout_id);
    else likeCount.set(r.workout_id, (likeCount.get(r.workout_id) ?? 0) + 1);
  }
  const commentCount = new Map<string, number>();
  for (const c of comments) commentCount.set(c.workout_id, (commentCount.get(c.workout_id) ?? 0) + 1);

  // Per-workout brag metadata: quarter ordinal, year ordinal, and whether it's
  // the member's most recent entry.
  const meta = new Map<string, { qCount: number; yrCount: number; isLatest: boolean }>();
  for (const ws of wByMember.values()) {
    const asc = [...ws].sort(
      (a, b) => a.workout_date.localeCompare(b.workout_date) || a.logged_at.localeCompare(b.logged_at),
    );
    const qc: Record<QuarterKey, number> = { q1: 0, q2: 0, q3: 0 };
    let yr = 0;
    for (const w of asc) {
      const { m } = parseDate(w.workout_date);
      const q = quarterOf(m);
      let qCount = 0;
      if (q) {
        qc[q] += 1;
        qCount = qc[q];
        yr += 1;
      }
      meta.set(w.id, { qCount, yrCount: yr, isLatest: false });
    }
    if (asc.length) meta.get(asc[asc.length - 1].id)!.isLatest = true;
  }

  // members -> Member[]
  const memberById = new Map<string, DbMember>();
  for (const m of members) memberById.set(m.id, m);

  const frens: Member[] = members.map((mem) => {
    const ws = wByMember.get(mem.id) ?? [];
    let q1 = 0,
      q2 = 0,
      q3 = 0;
    const maxByQ: Partial<Record<QuarterKey, string>> = {};
    const doys = new Set<number>();
    for (const w of ws) {
      const { y, m, d } = parseDate(w.workout_date);
      const q = quarterOf(m);
      if (q === "q1") q1++;
      else if (q === "q2") q2++;
      else if (q === "q3") q3++;
      if (q) {
        const cur = maxByQ[q];
        if (!cur || w.workout_date > cur) maxByQ[q] = w.workout_date;
      }
      if (y === IST_YEAR) doys.add(dayOfYear(y, m, d));
    }
    const last: Partial<Record<QuarterKey, string>> = {};
    (["q1", "q2", "q3"] as QuarterKey[]).forEach((q) => {
      const iso = maxByQ[q];
      if (iso) last[q] = lastLabel(iso);
    });
    return {
      name: mem.display_name,
      q1,
      q2,
      q3,
      streak: streakFromDoys(doys, TODAY_DOY),
      last,
      you: myMemberId === mem.id,
    };
  });
  const frensById = new Map<string, Member>();
  frens.forEach((f, i) => frensById.set(members[i].id, f));

  // Signed-in member's calendar / day details.
  const doneDoy = new Set<number>();
  const dayData: Record<number, WorkoutDetail> = {};
  let meName = "";
  if (myMemberId) {
    meName = memberById.get(myMemberId)?.display_name ?? "";
    for (const w of wByMember.get(myMemberId) ?? []) {
      const { y } = parseDate(w.workout_date);
      if (y !== IST_YEAR) continue;
      const doy = doyOfDate(w.workout_date);
      doneDoy.add(doy);
      dayData[doy] = {
        types: w.types ?? [],
        dur: minutesToLabel(w.duration_min),
        note: w.note ?? "",
        photo: !!w.photo_path,
      };
    }
  }

  // Feed = app-sourced workouts, newest first.
  const feed: FeedItem[] = workouts
    .filter((w) => w.source === "app")
    .sort((a, b) => b.logged_at.localeCompare(a.logged_at))
    .map((w) => {
      const mem = memberById.get(w.member_id);
      const memAgg = frensById.get(w.member_id);
      const mt = meta.get(w.id) ?? { qCount: 0, yrCount: 0, isLatest: false };
      const act = w.types && w.types.length ? w.types.join(" · ") : "Workout";
      return {
        id: w.id,
        n: mem?.display_name ?? "—",
        tm: feedTime(w.logged_at),
        act,
        brag: memAgg ? bragForWorkout(memAgg, mt.qCount, mt.yrCount, mt.isLatest) : "",
        note: w.note ?? "",
        likes: likeCount.get(w.id) ?? 0,
        c: commentCount.get(w.id) ?? 0,
        pic: !!w.photo_path,
        liked: myLiked.has(w.id),
      };
    });

  return { frens, meName, doneDoy, dayData, feed };
}

/** Find the signed-in member's workout id for a given day-of-year (or null). */
export function myWorkoutId(raw: RawData, myMemberId: string, iso: string): string | null {
  const row = raw.workouts.find((w) => w.member_id === myMemberId && w.workout_date === iso);
  return row?.id ?? null;
}

/** Pull all four tables in parallel. Requires a claimed session (RLS). */
export async function fetchRaw(supabase: SupabaseClient): Promise<RawData> {
  const [m, w, r, c] = await Promise.all([
    supabase.from("members").select("id, sheet_name, user_id, display_name, is_admin"),
    supabase.from("workouts").select("id, member_id, workout_date, types, duration_min, note, photo_path, source, logged_at"),
    supabase.from("reactions").select("id, workout_id, member_id, emoji"),
    supabase.from("comments").select("id, workout_id, member_id, body, created_at"),
  ]);
  if (m.error) throw m.error;
  if (w.error) throw w.error;
  if (r.error) throw r.error;
  if (c.error) throw c.error;
  return {
    members: (m.data ?? []) as DbMember[],
    workouts: (w.data ?? []) as DbWorkout[],
    reactions: (r.data ?? []) as DbReaction[],
    comments: (c.data ?? []) as DbComment[],
  };
}
