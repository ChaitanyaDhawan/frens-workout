"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  CURRENT_Q,
  IST_YEAR,
  MONTHS,
  RECENTS,
  TODAY_DOY,
  TODAY_ISO,
  TODAY_M,
  type FeedItem,
  type Member,
  type PeriodId,
  type WorkoutDetail,
} from "./data";
import { monthOf } from "./helpers";
import { useAuth } from "./auth";
import { aggregate, fetchRaw, labelToMinutes, type DbWorkout, type RawData } from "./db";
import { maybeSubscribeAfterLog } from "./push";
import { compressImage } from "./compressImage";
import { SAMPLE_RAW, DEMO_ME_ID } from "./demoData";
import { fx } from "./fx";

export type TabId = "home" | "board" | "you";
export type SheetMode = "log" | "edit";

export interface ToastState {
  message: string;
  undo?: () => void;
  duration: number;
  key: number;
}

interface Store {
  // ---- state ----
  tab: TabId;
  frens: Member[];
  me: Member;
  period: PeriodId;
  calM: number;
  doneDoy: Set<number>;
  dayData: Record<number, WorkoutDetail>;
  feed: FeedItem[];
  /** All of my own app-entered workouts, newest first (You tab paginates this). */
  mineFeed: FeedItem[];
  recents: string[];
  logged: boolean;
  bounceTick: number;
  rollTick: number;
  flapTick: number;
  reorderTick: number;
  toast: ToastState | null;
  sheet: { mode: SheetMode; doy: number } | null;
  daySheet: { doy: number } | null;
  celebration: CelebrationData | null;
  /** workoutId whose comment thread is open, or null. */
  commentSheet: string | null;
  commentsByWorkout: Map<string, CommentThreadItem[]>;
  /** workoutId whose kudos-givers list is open, or null. */
  kudosSheet: string | null;
  autoLog: boolean;
  /** Bumps after a log so the feed can scroll+spotlight the new card. */
  logFocusKey: number;
  /** Notification deep-link target (workout to scroll to; kudos = also burst). */
  deepLink: { id: string; kudos: boolean } | null;

  // ---- actions ----
  /** Re-pull all data from Supabase (drives pull-to-refresh). */
  refresh: () => Promise<void>;
  setTab: (v: TabId) => void;
  setPeriod: (p: PeriodId) => void;
  prevMonth: () => void;
  nextMonth: () => void;
  logToday: () => void;
  backfillDay: (doy: number) => void;
  removeDay: (doy: number) => void;
  saveDetails: (detail: WorkoutDetail, file?: File | null) => void;
  openSheet: (mode: SheetMode, doy: number) => void;
  closeSheet: () => void;
  openDaySheet: (doy: number) => void;
  closeDaySheet: () => void;
  closeCelebration: () => void;
  editCelebration: () => void;
  demoLog: () => void;
  addRecent: (t: string) => void;
  showToast: (message: string) => void;
  clearToast: () => void;
  /** Insert/remove my 🔥 reaction on a workout. */
  toggleLike: (workoutId: string, liked: boolean) => void;
  /** Post a comment on a workout. */
  addComment: (workoutId: string, body: string) => void;
  openCommentSheet: (workoutId: string) => void;
  closeCommentSheet: () => void;
  openKudosSheet: (workoutId: string) => void;
  closeKudosSheet: () => void;
  openAutoLog: () => void;
  closeAutoLog: () => void;
  /** Feed reads this once after a log to scroll+spotlight the new card. */
  consumeLogFocus: () => boolean;
  clearDeepLink: () => void;
}

// The full-screen celebration is kept in the codebase but pulled out of the log
// flow — after logging we scroll to the fresh feed card instead.
const SHOW_CELEBRATION = false;

const StoreContext = createContext<Store | null>(null);

const EMPTY_RAW: RawData = { members: [], workouts: [], reactions: [], comments: [], photoUrls: {} };
const pad2 = (n: number) => String(n).padStart(2, "0");
const tmpId = () => "tmp-" + Math.random().toString(36).slice(2);

function doyToIso(doy: number): string {
  const dt = new Date(Date.UTC(IST_YEAR, 0, doy));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}
function blankWorkout(memberId: string, iso: string): DbWorkout {
  return {
    id: tmpId(),
    member_id: memberId,
    workout_date: iso,
    types: [],
    duration_min: null,
    note: null,
    photo_path: null,
    source: "app",
    logged_at: new Date().toISOString(),
  };
}
function isoToDoy(iso: string): number {
  return Math.floor((Date.parse(iso + "T00:00:00Z") - Date.UTC(IST_YEAR, 0, 1)) / 86400000) + 1;
}
function streakOf(doys: Set<number>, today: number): number {
  let s = 0;
  let d = doys.has(today) ? today : today - 1;
  while (doys.has(d)) {
    s++;
    d--;
  }
  return s;
}
function quarterOfDoy(doy: number): 1 | 2 | 3 | 4 {
  return doy <= 90 ? 1 : doy <= 181 ? 2 : doy <= 273 ? 3 : 4;
}
const nth = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

export interface CelebrationData {
  doy: number;
  headline: string;
  sub: string;
  activity: string;
  stats: { label: string; value: string }[];
  /** local object URL of the just-added proof photo, for immediate display. */
  photoUrl?: string;
  key: number;
}

export interface CommentThreadItem {
  id: string;
  name: string;
  body: string;
  tm: string;
  mine: boolean;
}

function relTime(iso: string): string {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function StoreProvider({ children, demo = false }: { children: ReactNode; demo?: boolean }) {
  const { supabase, member, session } = useAuth();
  const myId = demo ? DEMO_ME_ID : (member?.id ?? null);
  const uid = session?.user.id ?? null;

  const [tab, setTab] = useState<TabId>("home");
  const [period, setPeriodState] = useState<PeriodId>(CURRENT_Q);
  const [calM, setCalM] = useState<number>(Math.min(Math.max(TODAY_M, 0), MONTHS.length - 1));

  const [raw, setRaw] = useState<RawData>(demo ? SAMPLE_RAW : EMPTY_RAW);
  const rawRef = useRef(raw);
  rawRef.current = raw;

  // Activities the user typed this session — immediate feedback before refetch.
  const [sessionRecents, setSessionRecents] = useState<string[]>([]);
  // Their real activity history, most-recent-first, so a custom chip persists
  // across sessions (derived from their own workouts' `types`, not a constant).
  const historyRecents = useMemo(() => {
    if (!myId) return [] as string[];
    const mine = raw.workouts
      .filter((w) => w.member_id === myId && w.types && w.types.length)
      .slice()
      .sort((a, b) => (a.workout_date < b.workout_date ? 1 : -1));
    const out: string[] = [];
    const seen = new Set<string>();
    for (const w of mine) {
      for (const t of w.types ?? []) {
        const v = t.trim();
        if (v && !seen.has(v.toLowerCase())) {
          seen.add(v.toLowerCase());
          out.push(v);
        }
      }
    }
    return out;
  }, [raw, myId]);
  // Merge just-added → history → defaults, case-insensitively deduped.
  const recents = useMemo(() => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const t of [...sessionRecents, ...historyRecents, ...RECENTS]) {
      const v = t.trim();
      if (v && !seen.has(v.toLowerCase())) {
        seen.add(v.toLowerCase());
        out.push(v);
      }
    }
    return out;
  }, [sessionRecents, historyRecents]);
  const recentsRef = useRef(recents);
  recentsRef.current = recents;

  const [bounceTick, setBounceTick] = useState(0);
  const [logTick, setLogTick] = useState(0);
  const [otherTick, setOtherTick] = useState(0);
  const [periodTick, setPeriodTick] = useState(0);

  const [toast, setToast] = useState<ToastState | null>(null);
  const toastKey = useRef(0);
  const [sheet, setSheet] = useState<{ mode: SheetMode; doy: number } | null>(null);
  const [daySheet, setDaySheet] = useState<{ doy: number } | null>(null);
  const [celebration, setCelebration] = useState<CelebrationData | null>(null);
  const celKey = useRef(0);
  const [commentSheet, setCommentSheet] = useState<string | null>(null);
  const [kudosSheet, setKudosSheet] = useState<string | null>(null);
  const [autoLog, setAutoLog] = useState(false);
  const [logFocusKey, setLogFocusKey] = useState(0);
  const focusConsumed = useRef(0);
  const [deepLink, setDeepLink] = useState<{ id: string; kudos: boolean } | null>(null);

  const [freshIds, setFreshIds] = useState<Set<string>>(() => new Set());

  // ---- derived view model ----
  const agg = useMemo(() => aggregate(raw, myId), [raw, myId]);
  const frens = agg.frens;
  const me = useMemo<Member>(
    () => agg.frens.find((f) => f.you) ?? { name: agg.meName || member?.display_name || "", q1: 0, q2: 0, q3: 0, streak: 0, last: {}, you: true },
    [agg, member],
  );
  const doneDoy = agg.doneDoy;
  const dayData = agg.dayData;
  const feed = useMemo(
    () => agg.feed.map((f) => (freshIds.has(f.id) ? { ...f, fresh: true } : f)),
    [agg.feed, freshIds],
  );
  const commentsByWorkout = useMemo(() => {
    const nameById = new Map(raw.members.map((m) => [m.id, m.display_name]));
    const map = new Map<string, CommentThreadItem[]>();
    for (const c of [...raw.comments].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
      const arr = map.get(c.workout_id) ?? [];
      arr.push({
        id: c.id,
        name: nameById.get(c.member_id) ?? "—",
        body: c.body,
        tm: relTime(c.created_at),
        mine: c.member_id === myId,
      });
      map.set(c.workout_id, arr);
    }
    return map;
  }, [raw, myId]);
  const mineFeed = agg.mineFeed;
  const logged = doneDoy.has(TODAY_DOY);

  // ---- helpers ----
  const patchRaw = useCallback((fn: (r: RawData) => RawData) => {
    setRaw((prev) => {
      const next = fn(prev);
      rawRef.current = next;
      return next;
    });
  }, []);

  const pushToast = useCallback((message: string, duration: number, undo?: () => void) => {
    toastKey.current += 1;
    setToast({ message, duration, undo, key: toastKey.current });
  }, []);
  const showToast = useCallback((message: string) => pushToast(message, 2600), [pushToast]);
  const clearToast = useCallback(() => setToast(null), []);

  const markFresh = useCallback((id: string) => {
    setFreshIds((prev) => {
      const n = new Set(prev);
      n.add(id);
      return n;
    });
    setTimeout(() => {
      setFreshIds((prev) => {
        if (!prev.has(id)) return prev;
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
    }, 1000);
  }, []);

  // ---- data load + realtime ----
  const refetch = useCallback(async () => {
    if (demo || !myId) return; // demo mode keeps its static sample data
    try {
      const data = await fetchRaw(supabase);
      rawRef.current = data;
      setRaw(data);
    } catch {
      /* transient — a later realtime event or visibility refetch reconciles */
    }
  }, [supabase, myId]);
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRefetch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => refetchRef.current(), 150);
  }, []);

  useEffect(() => {
    if (demo || !myId) return; // no live subscription in demo mode
    let cancelled = false;
    let channel: RealtimeChannel | null = null;

    refetch();

    const onWorkout = (payload: {
      eventType: string;
      new: Record<string, unknown> | null;
      old: Record<string, unknown> | null;
    }) => {
      const row = payload.new ?? payload.old;
      const mid = row?.member_id as string | undefined;
      if (mid && mid !== myId) setOtherTick((t) => t + 1);
      if (payload.eventType === "INSERT") {
        const n = payload.new;
        if (n && n.source === "app" && n.id) markFresh(n.id as string);
      }
      scheduleRefetch();
    };
    const onAux = () => scheduleRefetch();

    const subscribe = () => {
      channel = supabase
        .channel("frens-db-" + myId)
        .on("postgres_changes", { event: "*", schema: "public", table: "workouts" }, (payload) =>
          onWorkout(payload as unknown as Parameters<typeof onWorkout>[0]),
        )
        .on("postgres_changes", { event: "*", schema: "public", table: "reactions" }, onAux)
        .on("postgres_changes", { event: "*", schema: "public", table: "comments" }, onAux)
        .subscribe((status: string) => {
          if (
            !cancelled &&
            (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED")
          ) {
            if (channel) {
              supabase.removeChannel(channel);
              channel = null;
            }
            setTimeout(() => {
              if (!cancelled) subscribe();
            }, 2000);
          }
        });
    };
    subscribe();

    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      refetchRef.current();
      if (!channel || (channel.state as unknown as string) !== "joined") {
        if (channel) supabase.removeChannel(channel);
        channel = null;
        subscribe();
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (channel) supabase.removeChannel(channel);
    };
  }, [myId, supabase, refetch, scheduleRefetch, markFresh]);

  // ---- navigation ----
  const setPeriod = useCallback((p: PeriodId) => {
    setPeriodState(p);
    setPeriodTick((t) => t + 1);
  }, []);
  const prevMonth = useCallback(() => setCalM((m) => Math.max(0, m - 1)), []);
  const nextMonth = useCallback(() => setCalM((m) => Math.min(MONTHS.length - 1, m + 1)), []);

  const openSheet = useCallback((mode: SheetMode, doy: number) => {
    setDaySheet(null);
    setSheet({ mode, doy });
  }, []);
  const closeSheet = useCallback(() => setSheet(null), []);
  const openDaySheet = useCallback((doy: number) => {
    setSheet(null);
    setDaySheet({ doy });
  }, []);
  const closeDaySheet = useCallback(() => setDaySheet(null), []);

  // ---- writes ----
  const insertWorkout = useCallback(
    async (iso: string): Promise<{ ok: boolean; duplicate?: boolean }> => {
      if (!myId) return { ok: false };
      if (rawRef.current.workouts.some((w) => w.member_id === myId && w.workout_date === iso)) {
        return { ok: true, duplicate: true };
      }
      const optimistic = blankWorkout(myId, iso);
      patchRaw((r) => ({ ...r, workouts: [...r.workouts, optimistic] }));
      markFresh(optimistic.id);
      const { data, error } = await supabase
        .from("workouts")
        .insert({ member_id: myId, workout_date: iso, types: [], source: "app" })
        .select("id")
        .single();
      if (error) {
        if ((error as { code?: string }).code === "23505") {
          scheduleRefetch();
          return { ok: true, duplicate: true };
        }
        patchRaw((r) => ({ ...r, workouts: r.workouts.filter((w) => w.id !== optimistic.id) }));
        return { ok: false };
      }
      if (data?.id) {
        const realId = data.id as string;
        patchRaw((r) => ({
          ...r,
          workouts: r.workouts.map((w) => (w.id === optimistic.id ? { ...w, id: realId } : w)),
        }));
        markFresh(realId);
      }
      scheduleRefetch();
      return { ok: true };
    },
    [myId, supabase, patchRaw, markFresh, scheduleRefetch],
  );

  // Hold-to-log opens the detail sheet; the entry is only created on submit.
  const logToday = useCallback(() => {
    if (!myId) return;
    const already = rawRef.current.workouts.some((w) => w.member_id === myId && w.workout_date === TODAY_ISO);
    if (already) {
      showToast("Already on the record for today");
      return;
    }
    setSheet({ mode: "log", doy: TODAY_DOY });
  }, [myId, showToast]);

  const computeCelebration = useCallback(
    (doy: number, activity: string, photoUrl?: string): CelebrationData => {
      const mine = rawRef.current.workouts.filter((w) => w.member_id === myId);
      const doys = new Set(mine.map((w) => isoToDoy(w.workout_date)));
      doys.add(doy); // count the just-logged day even if the optimistic patch hasn't flushed yet
      const all = [...doys];
      const yearTotal = doys.size;
      const m = monthOf(doy);
      const monthTotal = all.filter((d) => d > m.off && d <= m.off + m.days).length;
      const q = quarterOfDoy(doy);
      const quarterTotal = all.filter((d) => quarterOfDoy(d) === q).length;
      const streak = streakOf(doys, TODAY_DOY);
      const sorted = [...doys].sort((a, b) => a - b);
      const idx = sorted.indexOf(doy);
      const gap = idx > 0 ? doy - sorted[idx - 1] : null;

      const MILESTONES = [10, 25, 50, 75, 100, 150, 200, 250, 300];
      let headline: string;
      let sub: string;
      if (yearTotal === 1) {
        headline = "First one on the record!";
        sub = "The FRENS grind starts now 🎉";
      } else if (MILESTONES.includes(yearTotal)) {
        headline = `${nth(yearTotal)} workout of 2026!`;
        sub = "That's a milestone 🏆";
      } else if (gap != null && gap > 10) {
        headline = "Welcome back!";
        sub = `${gap} days off — back on the board 👊`;
      } else if (streak >= 3) {
        headline = `${streak}-day streak!`;
        sub = "Don't break the chain 🔥";
      } else if (monthTotal % 5 === 0) {
        headline = `${monthTotal} this month 💪`;
        sub = `${nth(yearTotal)} of 2026`;
      } else {
        const nices = ["Nice work", "Logged it", "On the board", "Good one", "That counts"];
        headline = nices[yearTotal % nices.length];
        sub = `${nth(yearTotal)} this year · ${monthTotal} this month`;
      }

      const stats = [
        { label: "Streak", value: streak > 0 ? `${streak}🔥` : "—" },
        { label: "Month", value: String(monthTotal) },
        { label: "Quarter", value: String(quarterTotal) },
        { label: "2026", value: String(yearTotal) },
      ];
      celKey.current += 1;
      return { doy, headline, sub, activity, stats, photoUrl, key: celKey.current };
    },
    [myId],
  );

  const closeCelebration = useCallback(() => {
    setCelebration((c) => {
      // Land on Home and re-pop the just-logged card (its fresh window elapsed
      // behind the celebration overlay).
      if (c && myId) {
        const iso = doyToIso(c.doy);
        const w = rawRef.current.workouts.find((x) => x.member_id === myId && x.workout_date === iso);
        if (w) {
          setTab("home");
          setTimeout(() => markFresh(w.id), 60);
        }
      }
      return null;
    });
  }, [myId, markFresh]);
  const editCelebration = useCallback(() => {
    setCelebration((c) => {
      if (c) setSheet({ mode: "edit", doy: c.doy });
      return null;
    });
  }, []);

  const backfillDay = useCallback(
    async (doy: number) => {
      if (!myId) return;
      const iso = doyToIso(doy);
      const m = monthOf(doy);
      if (rawRef.current.workouts.some((w) => w.member_id === myId && w.workout_date === iso)) {
        showToast(`Already logged ${m.n.slice(0, 3)} ${doy - m.off}`);
        return;
      }
      setBounceTick((t) => t + 1);
      showToast(`Backfilled ${m.n.slice(0, 3)} ${doy - m.off} — labeled in the feed`);
      const res = await insertWorkout(iso);
      if (!res.ok) showToast("Couldn't backfill — try again");
    },
    [myId, insertWorkout, showToast],
  );

  // Undo-delete: re-insert the CAPTURED row with its details (not a blank one).
  const restoreWorkout = useCallback(
    async (row: DbWorkout) => {
      if (!myId) return;
      setBounceTick((t) => t + 1);
      const optimistic: DbWorkout = { ...row, id: tmpId() };
      patchRaw((r) => ({ ...r, workouts: [...r.workouts, optimistic] }));
      const { data, error } = await supabase
        .from("workouts")
        .insert({
          member_id: row.member_id,
          workout_date: row.workout_date,
          types: row.types ?? [],
          duration_min: row.duration_min,
          note: row.note,
          photo_path: row.photo_path,
          source: row.source,
        })
        .select("id")
        .single();
      if (error) {
        if ((error as { code?: string }).code === "23505") {
          scheduleRefetch();
          showToast("Restored");
          return;
        }
        patchRaw((r) => ({ ...r, workouts: r.workouts.filter((w) => w.id !== optimistic.id) }));
        showToast("Couldn't restore — try again");
        return;
      }
      if (data?.id) {
        const realId = data.id as string;
        patchRaw((r) => ({ ...r, workouts: r.workouts.map((w) => (w.id === optimistic.id ? { ...w, id: realId } : w)) }));
      }
      showToast("Restored");
      scheduleRefetch();
    },
    [myId, supabase, patchRaw, showToast, scheduleRefetch],
  );

  const removeDay = useCallback(
    async (doy: number) => {
      if (!myId) return;
      const iso = doyToIso(doy);
      const row = rawRef.current.workouts.find((w) => w.member_id === myId && w.workout_date === iso);
      setDaySheet(null);
      if (!row) return;
      const id = row.id;
      const savedReactions = rawRef.current.reactions.filter((x) => x.workout_id === id);
      const savedComments = rawRef.current.comments.filter((x) => x.workout_id === id);
      patchRaw((r) => ({
        ...r,
        workouts: r.workouts.filter((w) => w.id !== id),
        reactions: r.reactions.filter((x) => x.workout_id !== id),
        comments: r.comments.filter((x) => x.workout_id !== id),
      }));
      const m = monthOf(doy);
      pushToast(`Removed ${m.n.slice(0, 3)} ${doy - m.off}`, 4000, () => restoreWorkout(row));
      if (!id.startsWith("tmp-")) {
        const { error } = await supabase.from("workouts").delete().eq("id", id);
        if (error) {
          // Delete failed — roll the row AND its reactions/comments back, then resync.
          patchRaw((r) => ({
            ...r,
            workouts: [...r.workouts, row],
            reactions: [...r.reactions, ...savedReactions],
            comments: [...r.comments, ...savedComments],
          }));
          showToast("Couldn't delete — try again");
          scheduleRefetch();
          return;
        }
      }
      scheduleRefetch();
    },
    [myId, supabase, patchRaw, pushToast, restoreWorkout, showToast, scheduleRefetch],
  );

  const saveDetails = useCallback(
    async (detail: WorkoutDetail, file?: File | null) => {
      const cur = sheet;
      if (!cur || !myId) {
        setSheet(null);
        return;
      }
      const doy = cur.doy;
      const iso = doyToIso(doy);
      const minutes = labelToMinutes(detail.dur);
      const isEdit = cur.mode === "edit";
      const already = rawRef.current.workouts.some((w) => w.member_id === myId && w.workout_date === iso);
      const activity = detail.types[0] || "Workout";
      const photoUrl = file ? URL.createObjectURL(file) : undefined;
      setSheet(null);

      if (!already) {
        // Create-on-submit: optimistic row carries the details, tile/board flip, celebrate.
        const optimistic: DbWorkout = {
          ...blankWorkout(myId, iso),
          types: detail.types,
          duration_min: minutes,
          note: detail.note || null,
          photo_path: detail.photo ? "pending" : null,
        };
        patchRaw((r) => ({ ...r, workouts: [...r.workouts, optimistic] }));
        markFresh(optimistic.id);
        setLogTick((t) => t + 1);
        setBounceTick((t) => t + 1);
        if (SHOW_CELEBRATION) {
          setCelebration(computeCelebration(doy, activity, photoUrl)); // rawRef already has the new row
        } else if (doy === TODAY_DOY) {
          // Only for a TODAY log: land on the feed, spotlight the fresh card,
          // and pop a little confetti. A past-day backfill must NOT yank you to
          // Home / ring the wrong (index-0) card.
          setTab("home");
          setLogFocusKey((k) => k + 1);
          if (typeof window !== "undefined") {
            const w = window.innerWidth;
            const y = window.innerHeight * 0.3;
            fx.scraps({ left: w * 0.2, top: y, width: w * 0.6, right: w * 0.8, bottom: y + 8, height: 8, x: w / 2, y } as DOMRect);
          }
        }
      } else if (isEdit) {
        patchRaw((r) => ({
          ...r,
          workouts: r.workouts.map((w) =>
            w.member_id === myId && w.workout_date === iso
              ? { ...w, types: detail.types, duration_min: minutes, note: detail.note || null }
              : w,
          ),
        }));
        showToast("Entry updated.");
      }

      // Resolve / create the real row.
      let id: string | null = null;
      const local = rawRef.current.workouts.find((w) => w.member_id === myId && w.workout_date === iso);
      if (local && !local.id.startsWith("tmp-")) id = local.id;

      if (!already) {
        const { data, error } = await supabase
          .from("workouts")
          .insert({ member_id: myId, workout_date: iso, types: detail.types, duration_min: minutes, note: detail.note || null, source: "app" })
          .select("id")
          .single();
        if (error) {
          if ((error as { code?: string }).code === "23505") {
            scheduleRefetch();
          } else {
            patchRaw((r) => ({
              ...r,
              workouts: r.workouts.filter((w) => !(w.member_id === myId && w.workout_date === iso && w.id.startsWith("tmp-"))),
            }));
            showToast("Couldn't log — try again");
            return;
          }
        } else if (data?.id) {
          id = data.id as string;
          patchRaw((r) => ({
            ...r,
            workouts: r.workouts.map((w) =>
              w.member_id === myId && w.workout_date === iso && w.id.startsWith("tmp-") ? { ...w, id: id! } : w,
            ),
          }));
        }
      }
      if (!id) {
        const { data } = await supabase.from("workouts").select("id").eq("member_id", myId).eq("workout_date", iso).maybeSingle();
        id = (data?.id as string | undefined) ?? null;
      }
      if (!id) {
        scheduleRefetch();
        return;
      }

      let photoPath: string | null = null;
      if (file && uid) {
        try {
          const compressed = await compressImage(file); // WebP/JPEG shrink to spare the storage tier
          const ext = compressed.type === "image/webp" ? "webp" : "jpg";
          const path = `${uid}/${id}-${Date.now()}.${ext}`;
          const up = await supabase.storage.from("proof").upload(path, compressed, {
            upsert: true,
            contentType: compressed.type,
          });
          if (up.error) showToast("Couldn't attach the photo — saved without it");
          else photoPath = path;
        } catch {
          showToast("Couldn't attach the photo — saved without it");
        }
      }

      // New logs already carry details in the insert; only edits or a photo need an update.
      if (isEdit || photoPath) {
        const update: Record<string, unknown> = { types: detail.types, duration_min: minutes, note: detail.note || null };
        if (photoPath) update.photo_path = photoPath;
        const { error } = await supabase.from("workouts").update(update).eq("id", id);
        if (error) showToast("Couldn't save details");
      }
      void maybeSubscribeAfterLog(supabase, myId);
      scheduleRefetch();
    },
    [sheet, myId, uid, supabase, patchRaw, markFresh, showToast, scheduleRefetch, computeCelebration],
  );

  const toggleLike = useCallback(
    async (workoutId: string, liked: boolean) => {
      if (!myId) return;
      if (liked) {
        patchRaw((r) =>
          r.reactions.some((x) => x.workout_id === workoutId && x.member_id === myId && x.emoji === "🔥")
            ? r
            : { ...r, reactions: [...r.reactions, { id: tmpId(), workout_id: workoutId, member_id: myId, emoji: "🔥" }] },
        );
        const { error } = await supabase.from("reactions").insert({ workout_id: workoutId, member_id: myId, emoji: "🔥" });
        if (error && (error as { code?: string }).code !== "23505") {
          patchRaw((r) => ({ ...r, reactions: r.reactions.filter((x) => !(x.workout_id === workoutId && x.member_id === myId)) }));
        } else {
          scheduleRefetch();
        }
      } else {
        patchRaw((r) => ({ ...r, reactions: r.reactions.filter((x) => !(x.workout_id === workoutId && x.member_id === myId && x.emoji === "🔥")) }));
        const { error } = await supabase.from("reactions").delete().eq("workout_id", workoutId).eq("member_id", myId).eq("emoji", "🔥");
        if (error) scheduleRefetch();
        else scheduleRefetch();
      }
    },
    [myId, supabase, patchRaw, scheduleRefetch],
  );

  const addComment = useCallback(
    async (workoutId: string, body: string) => {
      if (!myId) return;
      const text = body.trim().slice(0, 500);
      if (!text) return;
      const optimistic = { id: tmpId(), workout_id: workoutId, member_id: myId, body: text, created_at: new Date().toISOString() };
      patchRaw((r) => ({ ...r, comments: [...r.comments, optimistic] }));
      showToast("Comment posted");
      const { error } = await supabase.from("comments").insert({ workout_id: workoutId, member_id: myId, body: text });
      if (error) {
        patchRaw((r) => ({ ...r, comments: r.comments.filter((c) => c.id !== optimistic.id) }));
        showToast("Couldn't comment — try again");
      } else {
        scheduleRefetch();
      }
    },
    [myId, supabase, patchRaw, showToast, scheduleRefetch],
  );

  const openCommentSheet = useCallback((workoutId: string) => setCommentSheet(workoutId), []);
  const closeCommentSheet = useCallback(() => setCommentSheet(null), []);
  const openKudosSheet = useCallback((workoutId: string) => setKudosSheet(workoutId), []);
  const closeKudosSheet = useCallback(() => setKudosSheet(null), []);
  const openAutoLog = useCallback(() => setAutoLog(true), []);
  const closeAutoLog = useCallback(() => setAutoLog(false), []);
  const consumeLogFocus = useCallback(() => {
    if (logFocusKey > 0 && focusConsumed.current !== logFocusKey) {
      focusConsumed.current = logFocusKey;
      return true;
    }
    return false;
  }, [logFocusKey]);
  const clearDeepLink = useCallback(() => setDeepLink(null), []);

  // Notification deep-link — from the ?w= param (cold open) or a service-worker
  // postMessage (app already running; more reliable than SW navigate in PWAs).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const applyUrl = (search: string) => {
      const p = new URLSearchParams(search);
      const w = p.get("w");
      if (!w) return;
      setDeepLink({ id: w, kudos: p.get("kudos") === "1" });
      setTab("home");
      window.history.replaceState(null, "", window.location.pathname);
    };
    applyUrl(window.location.search);
    const onMsg = (e: MessageEvent) => {
      const d = e.data as { type?: string; url?: string } | null;
      if (d?.type === "FRENS_DEEPLINK" && typeof d.url === "string") {
        const qi = d.url.indexOf("?");
        applyUrl(qi >= 0 ? d.url.slice(qi) : "");
      }
    };
    navigator.serviceWorker?.addEventListener("message", onMsg);
    return () => navigator.serviceWorker?.removeEventListener("message", onMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const demoLog = useCallback(() => {
    /* Demo affordance retired — real friend logs arrive via realtime. */
  }, []);

  const addRecent = useCallback((t: string) => {
    const v = t.trim();
    if (!v) return;
    setSessionRecents((prev) =>
      prev.some((x) => x.toLowerCase() === v.toLowerCase()) ? prev : [v, ...prev],
    );
  }, []);

  const value = useMemo<Store>(
    () => ({
      tab,
      frens,
      me,
      period,
      calM,
      doneDoy,
      dayData,
      feed,
      mineFeed,
      recents,
      logged,
      bounceTick,
      rollTick: logTick,
      flapTick: logTick + otherTick + periodTick,
      reorderTick: logTick + otherTick,
      toast,
      sheet,
      daySheet,
      celebration,
      commentSheet,
      commentsByWorkout,
      kudosSheet,
      logFocusKey,
      deepLink,
      refresh: refetch,
      setTab,
      setPeriod,
      prevMonth,
      nextMonth,
      logToday,
      backfillDay,
      removeDay,
      saveDetails,
      openSheet,
      closeSheet,
      openDaySheet,
      closeDaySheet,
      closeCelebration,
      editCelebration,
      demoLog,
      addRecent,
      showToast,
      clearToast,
      toggleLike,
      addComment,
      openCommentSheet,
      closeCommentSheet,
      openKudosSheet,
      closeKudosSheet,
      autoLog,
      openAutoLog,
      closeAutoLog,
      consumeLogFocus,
      clearDeepLink,
    }),
    [
      tab, frens, me, period, calM, doneDoy, dayData, feed, mineFeed, recents, logged, bounceTick,
      logTick, otherTick, periodTick, toast, sheet, daySheet, celebration, commentSheet, commentsByWorkout, logFocusKey,
      refetch, setPeriod, prevMonth, nextMonth,
      logToday, backfillDay, removeDay, saveDetails, openSheet, closeSheet, openDaySheet,
      closeDaySheet, closeCelebration, editCelebration, demoLog, addRecent, showToast, clearToast, toggleLike, addComment,
      openCommentSheet, closeCommentSheet, openKudosSheet, closeKudosSheet, kudosSheet, consumeLogFocus, deepLink, clearDeepLink,
      autoLog, openAutoLog, closeAutoLog,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
