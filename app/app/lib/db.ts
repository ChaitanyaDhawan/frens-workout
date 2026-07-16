// Live-data layer: fetches the FRENS Supabase tables and folds them into the
// exact view-model shapes the UI already consumes (Member / FeedItem /
// WorkoutDetail + the day-of-year set). Nothing here touches React or the DOM.

import type { SupabaseClient } from "@supabase/supabase-js";
import { CURRENT_Q, IST_YEAR, TODAY_DOY, type FeedItem, type Member, type QuarterKey, type WorkoutDetail } from "./data";
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
  /** signed URLs for proof photos, keyed by storage path. */
  photoUrls: Record<string, string>;
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
function quarterOf(m0: number): QuarterKey {
  return m0 < 3 ? "q1" : m0 < 6 ? "q2" : m0 < 9 ? "q3" : "q4";
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
/** Day-of-year (1-based) for a YYYY-MM-DD string in the app's calendar year. */
function isoDoy(iso: string): number {
  return Math.floor((Date.parse(iso + "T00:00:00Z") - Date.UTC(IST_YEAR, 0, 1)) / 86400000) + 1;
}

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

/** Longest run of consecutive workout days (this year) — for the profile. */
function bestStreakOf(doys: Set<number>): number {
  if (!doys.size) return 0;
  const sorted = [...doys].sort((a, b) => a - b);
  let best = 1;
  let cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    cur = sorted[i] === sorted[i - 1] + 1 ? cur + 1 : 1;
    if (cur > best) best = cur;
  }
  return best;
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
  mineFeed: FeedItem[];
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
    // Brag ordinals reset per calendar year, so a 2026 entry's "Nth this
    // quarter/year" never counts imported 2025 rows (asc is date-sorted).
    const qc: Record<QuarterKey, number> = { q1: 0, q2: 0, q3: 0, q4: 0 };
    let yr = 0;
    let curYear = -1;
    for (const w of asc) {
      const { y, m } = parseDate(w.workout_date);
      if (y !== curYear) {
        curYear = y;
        qc.q1 = qc.q2 = qc.q3 = qc.q4 = 0;
        yr = 0;
      }
      const q = quarterOf(m);
      qc[q] += 1;
      yr += 1;
      meta.set(w.id, { qCount: qc[q], yrCount: yr, isLatest: false });
    }
    if (asc.length) meta.get(asc[asc.length - 1].id)!.isLatest = true;
  }

  // members -> Member[]
  const memberById = new Map<string, DbMember>();
  for (const m of members) memberById.set(m.id, m);

  // Kudos RECEIVED per member (reactions on their workouts), split by quarter,
  // plus the names of who reacted on each workout (for feed avatars).
  const wOwnerQ = new Map<string, { owner: string; cur: boolean }>();
  for (const w of raw.workouts) {
    const { y, m } = parseDate(w.workout_date);
    wOwnerQ.set(w.id, { owner: w.member_id, cur: y === IST_YEAR && quarterOf(m) === CURRENT_Q });
  }
  const kudosAllBy = new Map<string, number>();
  const kudosQ3By = new Map<string, number>();
  const likersBy = new Map<string, string[]>();
  for (const rx of raw.reactions) {
    const info = wOwnerQ.get(rx.workout_id);
    if (info) {
      kudosAllBy.set(info.owner, (kudosAllBy.get(info.owner) ?? 0) + 1);
      if (info.cur) kudosQ3By.set(info.owner, (kudosQ3By.get(info.owner) ?? 0) + 1);
    }
    const nm = memberById.get(rx.member_id)?.display_name;
    if (nm) {
      const arr = likersBy.get(rx.workout_id) ?? [];
      arr.push(nm);
      likersBy.set(rx.workout_id, arr);
    }
  }

  const frens: Member[] = members.map((mem) => {
    const ws = wByMember.get(mem.id) ?? [];
    let q1 = 0,
      q2 = 0,
      q3 = 0,
      q4 = 0,
      allTime = 0,
      untagged = 0,
      total2025 = 0;
    const maxByQ: Partial<Record<QuarterKey, string>> = {};
    const doys = new Set<number>();
    const typeCounts: Record<string, number> = {};
    for (const w of ws) {
      const { y, m, d } = parseDate(w.workout_date);
      const q = quarterOf(m);
      allTime++;
      let tagged = false;
      for (const t of w.types ?? []) {
        const k = t.trim();
        if (k) {
          typeCounts[k] = (typeCounts[k] ?? 0) + 1;
          tagged = true;
        }
      }
      if (!tagged) untagged++;
      if (y === IST_YEAR - 1) total2025++;
      // Current-year quarters / streak / calendar only — 2025 rows never inflate these.
      if (y === IST_YEAR) {
        if (q === "q1") q1++;
        else if (q === "q2") q2++;
        else if (q === "q3") q3++;
        else if (q === "q4") q4++;
        const cur = maxByQ[q];
        if (!cur || w.workout_date > cur) maxByQ[q] = w.workout_date;
        doys.add(dayOfYear(y, m, d));
      }
    }
    const last: Partial<Record<QuarterKey, string>> = {};
    (["q1", "q2", "q3", "q4"] as QuarterKey[]).forEach((q) => {
      const iso = maxByQ[q];
      if (iso) last[q] = lastLabel(iso);
    });
    return {
      name: mem.display_name,
      q1,
      q2,
      q3,
      q4,
      streak: streakFromDoys(doys, TODAY_DOY),
      // "On fire" = worked out in the last 3 days — gap-tolerant, unlike a strict
      // streak, so alternate-day regulars still light up.
      hot: [0, 1, 2].some((k) => doys.has(TODAY_DOY - k)),
      last7: Array.from({ length: 7 }, (_, k) => k).reduce((n, k) => n + (doys.has(TODAY_DOY - k) ? 1 : 0), 0),
      last30: Array.from({ length: 30 }, (_, k) => k).reduce((n, k) => n + (doys.has(TODAY_DOY - k) ? 1 : 0), 0),
      lastDoy: doys.size ? Math.max(...doys) : undefined,
      kudosQ3: kudosQ3By.get(mem.id) ?? 0,
      kudosAll: kudosAllBy.get(mem.id) ?? 0,
      total2025,
      allTime,
      bestStreak: bestStreakOf(doys),
      typeCounts,
      untagged,
      days: doys,
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

  // Feed = the most recent workouts (any source), newest workout-day first, so
  // it's populated from imported history until in-app logs take over.
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const toFeedItem = (w: DbWorkout): FeedItem => {
    const mem = memberById.get(w.member_id);
    const memAgg = frensById.get(w.member_id);
    const mt = meta.get(w.id) ?? { qCount: 0, yrCount: 0, isLatest: false };
    const act = w.types && w.types.length ? w.types.join(" · ") : "Workout";
    const wLabel = `${MON[+w.workout_date.slice(5, 7) - 1]} ${+w.workout_date.slice(8, 10)}`;
    // App entries show when they were logged; a backfill (workout day ≠ the day
    // it was entered) shows the workout day AND when it was logged.
    const lp = istParts(new Date(w.logged_at));
    const loggedIso = `${lp.y}-${String(lp.m + 1).padStart(2, "0")}-${String(lp.d).padStart(2, "0")}`;
    const tm =
      w.source === "app"
        ? w.workout_date === loggedIso
          ? feedTime(w.logged_at)
          : `${wLabel} · logged ${feedTime(w.logged_at)}`
        : wLabel;
    return {
      id: w.id,
      n: mem?.display_name ?? "—",
      tm,
      act,
      brag: memAgg ? bragForWorkout(memAgg, mt.qCount, mt.yrCount, mt.isLatest) : "",
      note: w.note ?? "",
      dur: minutesToLabel(w.duration_min) ?? undefined,
      likes: likeCount.get(w.id) ?? 0,
      c: commentCount.get(w.id) ?? 0,
      pic: !!w.photo_path,
      picUrl: w.photo_path ? raw.photoUrls[w.photo_path] : undefined,
      liked: myLiked.has(w.id),
      mine: !!myMemberId && w.member_id === myMemberId,
      doy: isoDoy(w.workout_date),
      likers: likersBy.get(w.id) ?? [],
    };
  };

  // Activity stream — newest-LOGGED first, so a backfilled old day surfaces at
  // the top the moment it's entered (workout_date only as a tiebreak).
  const sorted = [...workouts].sort(
    (a, b) => b.logged_at.localeCompare(a.logged_at) || b.workout_date.localeCompare(a.workout_date),
  );
  const feed: FeedItem[] = sorted.slice(0, 24).map(toFeedItem);
  // Every one of my own app-entered workouts, newest first — the You tab paginates this.
  const mineFeed: FeedItem[] = myMemberId
    ? sorted.filter((w) => w.member_id === myMemberId && w.source === "app").map(toFeedItem)
    : [];

  return { frens, meName, doneDoy, dayData, feed, mineFeed };
}

/** Find the signed-in member's workout id for a given day-of-year (or null). */
export function myWorkoutId(raw: RawData, myMemberId: string, iso: string): string | null {
  const row = raw.workouts.find((w) => w.member_id === myMemberId && w.workout_date === iso);
  return row?.id ?? null;
}

/** Pull all four tables in parallel. Requires a claimed session (RLS). */
export async function fetchRaw(supabase: SupabaseClient): Promise<RawData> {
  // Explicit order + high limit so we never hit PostgREST's default 1000-row cap
  // silently (reactions/workouts cross 1000 late in the year) and the result set
  // is deterministic.
  const CAP = 50000;
  const [m, w, r, c] = await Promise.all([
    supabase.from("members").select("id, sheet_name, user_id, display_name, is_admin").order("id"),
    supabase
      .from("workouts")
      .select("id, member_id, workout_date, types, duration_min, note, photo_path, source, logged_at")
      .order("id")
      .limit(CAP),
    supabase.from("reactions").select("id, workout_id, member_id, emoji").order("id").limit(CAP),
    supabase.from("comments").select("id, workout_id, member_id, body, created_at").order("id").limit(CAP),
  ]);
  if (m.error) throw m.error;
  if (w.error) throw w.error;
  if (r.error) throw r.error;
  if (c.error) throw c.error;

  // Signed URLs for proof photos (private bucket).
  const photoUrls: Record<string, string> = {};
  const paths = (w.data ?? [])
    .map((row) => (row as DbWorkout).photo_path)
    .filter((p): p is string => !!p && p !== "pending");
  if (paths.length) {
    const { data: signed } = await supabase.storage.from("proof").createSignedUrls(paths, 3600);
    for (const s of signed ?? []) {
      if (s.signedUrl && s.path) photoUrls[s.path] = s.signedUrl;
    }
  }

  return {
    members: (m.data ?? []) as DbMember[],
    workouts: (w.data ?? []) as DbWorkout[],
    reactions: (r.data ?? []) as DbReaction[],
    comments: (c.data ?? []) as DbComment[],
    photoUrls,
  };
}
