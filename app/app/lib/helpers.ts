import {
  MONTHS,
  TODAY_DOY,
  type Member,
  type PeriodId,
  type QuarterKey,
} from "./data";

export const pad = (n: number) => String(n).padStart(2, "0");

export const initials = (n: string) =>
  n
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/** Value for a member in a given period (quarters, 2026, 2025, or all-time). */
export const val = (f: Member, p: PeriodId): number => {
  const yr2026 = f.q1 + f.q2 + f.q3 + (f.q4 ?? 0);
  return p === "q1"
    ? f.q1
    : p === "q2"
      ? f.q2
      : p === "q3"
        ? f.q3
        : p === "q4"
          ? f.q4 ?? 0
          : p === "y25"
            ? f.total2025 ?? 0
            : p === "all"
              ? f.allTime ?? yr2026
              : yr2026; // "yr" = 2026 total
};

/** Last workout label for a member in a given period. */
export const lastOf = (f: Member, p: PeriodId): string | undefined => {
  if (p === "q1" || p === "q2" || p === "q3" || p === "q4") return f.last[p];
  if (p === "y25") return undefined; // no per-2025 last-date tracked yet
  return f.last.q4 || f.last.q3 || f.last.q2 || f.last.q1;
};

export const doyQuarter = (d: number): QuarterKey => (d <= 90 ? "q1" : d <= 181 ? "q2" : "q3");

/** Current streak ending today (or yesterday), given the set of logged days. */
export function streakNow(doneDoy: Set<number>): number {
  let s = 0;
  let d = doneDoy.has(TODAY_DOY) ? TODAY_DOY : TODAY_DOY - 1;
  while (doneDoy.has(d)) {
    s++;
    d--;
  }
  return s;
}

/** Longest run of consecutive logged days up to today. */
export function bestStreak(doneDoy: Set<number>): number {
  let best = 0;
  let run = 0;
  for (let d = 1; d <= TODAY_DOY; d++) {
    if (doneDoy.has(d)) {
      run++;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }
  return best;
}

/** Competition rank for a member in a period (ties share a rank). */
export function rankOf(frens: Member[], name: string, p: PeriodId): number {
  const sorted = [...frens].sort((a, b) => val(b, p) - val(a, p) || a.name.localeCompare(b.name));
  let rank = 0;
  let prev: number | null = null;
  let shown = 0;
  let res = sorted.length;
  sorted.forEach((f) => {
    shown++;
    if (val(f, p) !== prev) {
      rank = shown;
      prev = val(f, p);
    }
    if (f.name === name) res = rank;
  });
  return res;
}

export const nth = (n: number): string => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

/** Feed brag line for a member (streak / year / quarter milestone). */
export function bragFor(f: Member): string {
  if (f.streak > 1) return `${f.streak}-day streak 🔥`;
  const yr = f.q1 + f.q2 + f.q3;
  if (yr > 2 * f.q3 && yr >= 20) return `${nth(yr)} in 2026`;
  return `${nth(f.q3)} this quarter`;
}

/** Full "Monday, Jul 15" style label for a day-of-year. */
export function fmtDate(doy: number): string {
  const dow = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][(doy + 2) % 7];
  let m = MONTHS[0];
  for (const mm of MONTHS) {
    if (doy > mm.off && doy <= mm.off + mm.days) {
      m = mm;
      break;
    }
  }
  return `${dow}, ${m.n.slice(0, 3)} ${doy - m.off}`;
}

/** Month containing a day-of-year (used for toast labels on backfill/remove). */
export function monthOf(doy: number) {
  let m = MONTHS[0];
  for (const mm of MONTHS) {
    if (doy > mm.off && doy <= mm.off + mm.days) {
      m = mm;
      break;
    }
  }
  return m;
}

export interface WeekCell {
  label: string;
  doy: number;
  hit: boolean;
  today: boolean;
}

/** The trailing 7-day strip (Mon-start weekday letters), oldest → today. */
export function weekCells(doneDoy: Set<number>): WeekCell[] {
  const wl = ["M", "T", "W", "T", "F", "S", "S"];
  const cells: WeekCell[] = [];
  for (let i = 6; i >= 0; i--) {
    const doy = TODAY_DOY - i;
    const dowIdx = (doy + 2) % 7; // Jan 1 (doy 1) = Thu -> Mon-start index 3
    cells.push({
      label: wl[dowIdx],
      doy,
      hit: doneDoy.has(doy),
      today: doy === TODAY_DOY,
    });
  }
  return cells;
}

export const reduceMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
