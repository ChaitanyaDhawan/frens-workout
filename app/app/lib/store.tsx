"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  DEMO_ACTS,
  DEMO_NOTES,
  DEMO_POOL,
  FEED,
  FRENS,
  MONTHS,
  RECENTS,
  TODAY_DOY,
  type FeedItem,
  type Member,
  type PeriodId,
  type WorkoutDetail,
} from "./data";
import { bragFor, doyQuarter, monthOf } from "./helpers";

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
  recents: string[];
  logged: boolean;
  bounceTick: number;
  /** Bumped on today's plate log — Home tile flaps roll (count up). */
  rollTick: number;
  /** Bumped on log / demo / period-switch — Board flaps flip in place. */
  flapTick: number;
  /** Bumped on log / demo only — Board rows animate their reorder (FLIP). */
  reorderTick: number;
  toast: ToastState | null;
  sheet: { mode: SheetMode; doy: number } | null;
  daySheet: { doy: number } | null;

  // ---- actions ----
  setTab: (v: TabId) => void;
  setPeriod: (p: PeriodId) => void;
  prevMonth: () => void;
  nextMonth: () => void;
  logToday: () => void;
  backfillDay: (doy: number) => void;
  /** Delete a logged day (removes details + tick + count) with an undo toast. */
  removeDay: (doy: number) => void;
  saveDetails: (detail: WorkoutDetail) => void;
  openSheet: (mode: SheetMode, doy: number) => void;
  closeSheet: () => void;
  openDaySheet: (doy: number) => void;
  closeDaySheet: () => void;
  demoLog: () => void;
  addRecent: (t: string) => void;
  showToast: (message: string) => void;
  clearToast: () => void;
}

const StoreContext = createContext<Store | null>(null);

let feedSeq = 0;
const nextFeedId = () => `f${feedSeq++}`;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [tab, setTab] = useState<TabId>("home");
  const [frens, setFrens] = useState<Member[]>(() => FRENS.map((f) => ({ ...f, last: { ...f.last } })));
  const [period, setPeriodState] = useState<PeriodId>("q3");
  const [calM, setCalM] = useState<number>(6);
  const [doneDoy, setDoneDoy] = useState<Set<number>>(() => new Set());
  const [dayData, setDayData] = useState<Record<number, WorkoutDetail>>({});
  const [feed, setFeed] = useState<FeedItem[]>(() => FEED.map((f) => ({ ...f })));
  const [recents, setRecents] = useState<string[]>(() => [...RECENTS]);
  const [logged, setLogged] = useState(false);
  const [bounceTick, setBounceTick] = useState(0);
  const [logTick, setLogTick] = useState(0);
  const [demoTick, setDemoTick] = useState(0);
  const [periodTick, setPeriodTick] = useState(0);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [sheet, setSheet] = useState<{ mode: SheetMode; doy: number } | null>(null);
  const [daySheet, setDaySheet] = useState<{ doy: number } | null>(null);

  // Refs mirror the latest values so actions never read stale closures.
  const frensRef = useRef(frens);
  const doneRef = useRef(doneDoy);
  const dayDataRef = useRef(dayData);
  const recentsRef = useRef(recents);
  const toastKey = useRef(0);
  const demoIdx = useRef(0);

  const me = useMemo(() => frens.find((f) => f.you)!, [frens]);

  const bumpFrensQuarter = useCallback((doy: number, delta: number) => {
    const q = doyQuarter(doy);
    setFrens((prev) => {
      const next = prev.map((f) => (f.you ? { ...f, [q]: f[q] + delta } : f));
      frensRef.current = next;
      return next;
    });
  }, []);

  const addDone = useCallback((doy: number) => {
    setDoneDoy((prev) => {
      const n = new Set(prev);
      n.add(doy);
      doneRef.current = n;
      return n;
    });
  }, []);

  const removeDone = useCallback((doy: number) => {
    setDoneDoy((prev) => {
      const n = new Set(prev);
      n.delete(doy);
      doneRef.current = n;
      return n;
    });
  }, []);

  const bounce = useCallback(() => setBounceTick((t) => t + 1), []);

  const pushToast = useCallback((message: string, duration: number, undo?: () => void) => {
    toastKey.current += 1;
    setToast({ message, duration, undo, key: toastKey.current });
  }, []);

  const showToast = useCallback((message: string) => pushToast(message, 2600), [pushToast]);
  const clearToast = useCallback(() => setToast(null), []);

  const prependCard = useCallback((card: Omit<FeedItem, "id" | "fresh">) => {
    const item: FeedItem = { ...card, id: nextFeedId(), fresh: true };
    setFeed((prev) => {
      const next = [item, ...prev];
      return next;
    });
  }, []);

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

  const logToday = useCallback(() => {
    setLogged(true);
    bumpFrensQuarter(TODAY_DOY, +1);
    addDone(TODAY_DOY);
    bounce();
    setLogTick((t) => t + 1);
    // Compute brag from the post-increment "me".
    const updatedMe = { ...frensRef.current.find((f) => f.you)! };
    updatedMe.q3 += 1; // frensRef may not have flushed yet this tick
    prependCard({
      n: "Chaitanya",
      tm: "Just now",
      act: "Workout",
      brag: `${bragFor(updatedMe)} · off the mark!`,
      note: "",
      likes: 0,
      c: 0,
    });
    setSheet({ mode: "log", doy: TODAY_DOY });
  }, [addDone, bounce, bumpFrensQuarter, prependCard]);

  const backfillDay = useCallback(
    (doy: number) => {
      addDone(doy);
      bumpFrensQuarter(doy, +1);
      bounce();
      const m = monthOf(doy);
      showToast(`Backfilled ${m.n.slice(0, 3)} ${doy - m.off} — labeled in the feed`);
    },
    [addDone, bounce, bumpFrensQuarter, showToast],
  );

  const removeDay = useCallback(
    (doy: number, label: string) => {
      removeDone(doy);
      bumpFrensQuarter(doy, -1);
      pushToast(`Removed ${label}`, 4000, () => {
        addDone(doy);
        bumpFrensQuarter(doy, +1);
        bounce();
        showToast("Restored");
      });
    },
    [addDone, bounce, bumpFrensQuarter, pushToast, removeDone, showToast],
  );

  const saveDetails = useCallback(
    (detail: WorkoutDetail) => {
      const cur = sheet;
      if (cur) {
        setDayData((prev) => {
          const next = { ...prev, [cur.doy]: detail };
          dayDataRef.current = next;
          return next;
        });
        showToast(cur.mode === "log" ? "Details filed." : "Entry updated.");
      }
      setSheet(null);
    },
    [sheet, showToast],
  );

  const deleteDay = useCallback(
    (doy: number) => {
      setDayData((prev) => {
        const next = { ...prev };
        delete next[doy];
        dayDataRef.current = next;
        return next;
      });
      const m = monthOf(doy);
      removeDay(doy, `${m.n.slice(0, 3)} ${doy - m.off}`);
    },
    [removeDay],
  );

  const demoLog = useCallback(() => {
    const who = DEMO_POOL[demoIdx.current % DEMO_POOL.length];
    const current = frensRef.current.find((x) => x.name === who)!;
    const updated: Member = { ...current, q3: current.q3 + 1, last: { ...current.last, q3: "Jul 15" } };
    setFrens((prev) => {
      const next = prev.map((f) => (f.name === who ? updated : f));
      frensRef.current = next;
      return next;
    });
    prependCard({
      n: who,
      tm: "Just now",
      act: DEMO_ACTS[demoIdx.current % DEMO_ACTS.length],
      brag: bragFor(updated),
      note: DEMO_NOTES[demoIdx.current % DEMO_NOTES.length],
      likes: 0,
      c: 0,
    });
    demoIdx.current += 1;
    setDemoTick((t) => t + 1);
    showToast(`${who} just logged a workout`);
  }, [prependCard, showToast]);

  const addRecent = useCallback((t: string) => {
    if (!recentsRef.current.includes(t)) {
      setRecents((prev) => {
        const next = [t, ...prev];
        recentsRef.current = next;
        return next;
      });
    }
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
      recents,
      logged,
      bounceTick,
      rollTick: logTick,
      flapTick: logTick + demoTick + periodTick,
      reorderTick: logTick + demoTick,
      toast,
      sheet,
      daySheet,
      setTab,
      setPeriod,
      prevMonth,
      nextMonth,
      logToday,
      backfillDay,
      removeDay: deleteDay,
      saveDetails,
      openSheet,
      closeSheet,
      openDaySheet,
      closeDaySheet,
      demoLog,
      addRecent,
      showToast,
      clearToast,
    }),
    [
      tab, frens, me, period, calM, doneDoy, dayData, feed, recents, logged, bounceTick,
      logTick, demoTick, periodTick, toast, sheet, daySheet, setPeriod, prevMonth, nextMonth,
      logToday, backfillDay, deleteDay, saveDetails, openSheet, closeSheet, openDaySheet,
      closeDaySheet, demoLog, addRecent, showToast, clearToast,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
