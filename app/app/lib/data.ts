// Data seam for the FRENS Workout tracker.
// These placeholder arrays mirror the approved mock. When Supabase is wired up
// later, these exports are what get replaced with live queries — keep this a
// clean, typed module with no UI concerns.

export type PeriodId = "q1" | "q2" | "q3" | "yr" | "all";

export type QuarterKey = "q1" | "q2" | "q3";

export interface Member {
  name: string;
  q1: number;
  q2: number;
  q3: number;
  streak: number;
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
  /** Stable id so React can key freshly-prepended cards. */
  id: string;
  n: string;
  tm: string;
  act?: string;
  brag?: string;
  note?: string;
  likes: number;
  c: number;
  pic?: boolean;
  /** Play the card-in animation once, for just-logged entries. */
  fresh?: boolean;
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

export const PERIODS: Period[] = [
  { id: "q1", lbl: "Q1 ’26", final: true },
  { id: "q2", lbl: "Q2 ’26", final: true },
  { id: "q3", lbl: "Q3 ’26", live: true },
  { id: "yr", lbl: "2026" },
  { id: "all", lbl: "All-time" },
];

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
];

export const TODAY_DOY = 196;
export const TODAY_M = 6;
export const TODAY_D = 15;

// Activity chip options for the detail sheet.
export const RECENTS = ["Gym", "Run"];
export const DEFAULTS = ["Lift", "Yoga", "Football", "Swim", "Badminton"];

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
export const DEMO_ACTS = ["Run", "Gym workout", "Lift", "Badminton", "Gym workout", "Yoga"];
