// Data seam for the FRENS Workout tracker.
// These placeholder arrays mirror the approved mock. When Supabase is wired up
// later, these exports are what get replaced with live queries — keep this a
// clean, typed module with no UI concerns.

export type PeriodId = "q1" | "q2" | "q3" | "q4" | "yr" | "y25" | "all";

export type QuarterKey = "q1" | "q2" | "q3" | "q4";

export interface Member {
  name: string;
  q1: number;
  q2: number;
  q3: number;
  /** Q4 count — optional so placeholder rows without it stay valid. */
  q4?: number;
  streak: number;
  /** Worked out within the last 3 days — drives the animated "on fire" flame. */
  hot?: boolean;
  /** Workouts in the last 7 / 30 days, and the day-of-year of the latest one —
   *  feed the leaderboard's "cool fact" sub-label. */
  last7?: number;
  last30?: number;
  lastDoy?: number;
  /** Kudos RECEIVED (reactions on my workouts) this quarter and all-time. */
  kudosQ3?: number;
  kudosAll?: number;
  /** 2025 total + all-time total (all years) — for the 2025 / All-time boards. */
  total2025?: number;
  allTime?: number;
  /** Profile: longest streak this year, activity-type tally, and the set of
   *  this year's workout days (for the profile's 30-day strip). */
  bestStreak?: number;
  typeCounts?: Record<string, number>;
  /** Workouts with no activity type (mostly imported check-mark history). */
  untagged?: number;
  days?: Set<number>;
  /** Last workout date per quarter, e.g. { q1: "Mar 30", q3: "Jul 13" }. */
  last: Partial<Record<QuarterKey, string>>;
  /** True for the signed-in athlete (drives the "YOU" tag + Home tile). */
  you?: boolean;
}

export interface Period {
  id: PeriodId;
  lbl: string;
  /** A closed quarter — shows a "Final." banner and a "· F" suffix. */
  final?: boolean;
  /** The currently-running quarter — shows a live dot + progress bar. */
  live?: boolean;
}

export interface FeedItem {
  /** Stable id so React can key freshly-prepended cards. In live mode this is
   *  the workout row's uuid. */
  id: string;
  n: string;
  tm: string;
  act?: string;
  brag?: string;
  note?: string;
  /** Formatted duration, e.g. "45 min", when the logger added one. */
  dur?: string;
  likes: number;
  c: number;
  pic?: boolean;
  /** True when this is the signed-in member's own workout (shows the edit icon). */
  mine?: boolean;
  /** Day-of-year of the workout, so the edit icon can open the right day sheet. */
  doy?: number;
  /** signed URL for the proof photo, when available. */
  picUrl?: string;
  /** Play the card-in animation once, for just-logged entries. */
  fresh?: boolean;
  /** Whether the signed-in member has reacted (🔥) to this workout. */
  liked?: boolean;
  /** Display names of everyone who gave kudos on this workout. */
  likers?: string[];
}

/** A month in the 2026 calendar model (Monday-start). */
export interface MonthModel {
  n: string;
  /** Number of days in the month. */
  days: number;
  /** Leading Monday-start pad cells before day 1. */
  start: number;
  /** Day-of-year offset: doy of day 1 = off + 1. */
  off: number;
}

/** Optional details attached to a logged day. */
export interface WorkoutDetail {
  types: string[];
  dur: string | null;
  note: string;
  photo: boolean;
}

export const FRENS: Member[] = [
  { name: "Abhimanyu", q1: 10, q2: 20, q3: 8, streak: 0, last: { q1: "Mar 30", q2: "Jun 30", q3: "Jul 13" } },
  { name: "Akshit", q1: 0, q2: 0, q3: 0, streak: 0, last: {} },
  { name: "Bhawna", q1: 0, q2: 0, q3: 0, streak: 0, last: {} },
  { name: "Chaitanya", q1: 0, q2: 0, q3: 0, streak: 0, last: {}, you: true },
  { name: "Mugdha", q1: 45, q2: 37, q3: 5, streak: 0, last: { q1: "Mar 31", q2: "Jun 27", q3: "Jul 12" } },
  { name: "Rahul", q1: 0, q2: 9, q3: 9, streak: 1, last: { q2: "Jun 30", q3: "Jul 14" } },
  { name: "Saksham", q1: 41, q2: 0, q3: 0, streak: 0, last: { q1: "Mar 30" } },
  { name: "Saurabh", q1: 0, q2: 0, q3: 0, streak: 0, last: {} },
  { name: "Shashwat N.", q1: 6, q2: 0, q3: 0, streak: 0, last: { q1: "Feb 9" } },
  { name: "Vareni", q1: 34, q2: 27, q3: 3, streak: 0, last: { q1: "Mar 31", q2: "Jun 27", q3: "Jul 9" } },
  { name: "Shaswat K.", q1: 26, q2: 10, q3: 0, streak: 0, last: { q1: "Mar 31", q2: "Apr 22" } },
  { name: "Saavy", q1: 12, q2: 16, q3: 1, streak: 0, last: { q1: "Mar 30", q2: "Jun 29", q3: "Jul 1" } },
  { name: "Radhika", q1: 0, q2: 0, q3: 0, streak: 0, last: {} },
];

// PERIODS is computed from the current quarter (see below TODAY_* — it needs
// TODAY_M), so finished quarters flip to "final" and the running one to "live"
// automatically, and Q4 appears once October arrives.

export const FEED: FeedItem[] = [
  { id: "seed-rahul", n: "Rahul", tm: "Today · 07:02", act: "Run", brag: "9th this quarter", note: "5k before work. Streak holds.", likes: 4, c: 2, pic: false },
  { id: "seed-abhimanyu", n: "Abhimanyu", tm: "Yesterday · 19:40", act: "Gym workout", brag: "8th this quarter", note: "Push day. Bench moved easy.", likes: 6, c: 3, pic: true },
  { id: "seed-mugdha", n: "Mugdha", tm: "Sunday · 08:15", act: "Yoga", brag: "87th in 2026", note: "", likes: 3, c: 1, pic: false },
];

// Calendar model — 2026, Monday-start.
export const MONTHS: MonthModel[] = [
  { n: "January", days: 31, start: 3, off: 0 },
  { n: "February", days: 28, start: 6, off: 31 },
  { n: "March", days: 31, start: 6, off: 59 },
  { n: "April", days: 30, start: 2, off: 90 },
  { n: "May", days: 31, start: 4, off: 120 },
  { n: "June", days: 30, start: 0, off: 151 },
  { n: "July", days: 31, start: 2, off: 181 },
  { n: "August", days: 31, start: 5, off: 212 },
  { n: "September", days: 30, start: 1, off: 243 },
  { n: "October", days: 31, start: 3, off: 273 },
  { n: "November", days: 30, start: 6, off: 304 },
  { n: "December", days: 31, start: 1, off: 334 },
];

// "Today" in India Standard Time, computed at module load so the app follows
// the real calendar date instead of a frozen constant. Deterministic across
// server render + client hydration because it reads the same instant through
// the Asia/Kolkata zone on both.
const pad2 = (n: number) => String(n).padStart(2, "0");
function istToday(): { y: number; m: number; d: number } {
  const s = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [y, m, d] = s.split("-").map(Number);
  return { y, m: m - 1, d };
}
const _ist = istToday();
/** Calendar year in IST (the tracker models a single year). */
export const IST_YEAR = _ist.y;
/** Day-of-year for today, IST (Jan 1 = 1). */
export const TODAY_DOY =
  Math.floor((Date.UTC(_ist.y, _ist.m, _ist.d) - Date.UTC(_ist.y, 0, 1)) / 86400000) + 1;
/** Month index (0 = Jan) for today, IST. */
export const TODAY_M = _ist.m;
/** Day-of-month for today, IST. */
export const TODAY_D = _ist.d;
/** Today as an ISO calendar date (YYYY-MM-DD), IST. */
export const TODAY_ISO = `${_ist.y}-${pad2(_ist.m + 1)}-${pad2(_ist.d)}`;

/** Quarter (q1..q4) for a 0-based month index. */
export function quarterOfMonth(m: number): QuarterKey {
  return m < 3 ? "q1" : m < 6 ? "q2" : m < 9 ? "q3" : "q4";
}
/** The quarter currently in progress (IST). Drives the live board + default tab. */
export const CURRENT_Q = quarterOfMonth(TODAY_M);
/** Inclusive day-of-year bounds [start, end] for each quarter (2026, non-leap). */
export const Q_BOUNDS: Record<QuarterKey, [number, number]> = {
  q1: [1, 90],
  q2: [91, 181],
  q3: [182, 273],
  q4: [274, 365],
};
const Q_ORDER: QuarterKey[] = ["q1", "q2", "q3", "q4"];
const Q_LBL: Record<QuarterKey, string> = {
  q1: "Q1 ’26",
  q2: "Q2 ’26",
  q3: "Q3 ’26",
  q4: "Q4 ’26",
};
const _curQi = Q_ORDER.indexOf(CURRENT_Q);
/** Period picker: every quarter up to the current one (past = final, current =
 *  live), then 2026 · 2025 · All-time. Q4 auto-appears on Oct 1. */
export const PERIODS: Period[] = [
  ...Q_ORDER.slice(0, _curQi + 1).map((id, i) => ({
    id,
    lbl: Q_LBL[id],
    final: i < _curQi ? true : undefined,
    live: i === _curQi ? true : undefined,
  })),
  { id: "yr", lbl: "2026" },
  { id: "y25", lbl: "2025", final: true },
  { id: "all", lbl: "All-time" },
];

// Activity chip options for the detail sheet.
export const RECENTS = ["Gym", "Run"];
// "Gym" is the single strength entity (in RECENTS); "Lift" was merged into it.
export const DEFAULTS = ["Yoga", "Football", "Swim", "Badminton", "Dance"];

// Demo button pools — a friend "logs" a workout on tap.
export const DEMO_POOL = ["Vareni", "Mugdha", "Saksham", "Abhimanyu", "Saavy", "Bhawna"];
export const DEMO_NOTES = [
  "Evening run, easy pace.",
  "Court booked. Cooked.",
  "Back at it.",
  "Leg day. Regret.",
  "Quick lift before dinner.",
  "Sunset walk + stretches.",
];
export const DEMO_ACTS = ["Run", "Gym", "Swim", "Badminton", "Gym", "Yoga"];
