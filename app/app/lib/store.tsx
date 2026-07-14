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
  rollTick: number;
  flapTick: number;
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
  removeDay: (doy: number) => void;
  saveDetails: (detail: WorkoutDetail, file?: File | null) => void;
  openSheet: (mode: SheetMode, doy: number) => void;
  closeSheet: () => void;
  openDaySheet: (doy: number) => void;
  closeDaySheet: () => void;
  demoLog: () => void;
  addRecent: (t: string) => void;
  showToast: (message: string) => void;
  clearToast: () => void;
  /** Insert/remove my 🔥 reaction on a workout. */
  toggleLike: (workoutId: string, liked: boolean) => void;
  /** Post a comment on a workout. */
  addComment: (workoutId: string, body: string) => void;
}

const StoreContext = createContext<Store | null>(null);

const EMPTY_RAW: RawData = { members: [], workouts: [], reactions: [], comments: [] };
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

export function StoreProvider({ children }: { children: ReactNode }) {
  const { supabase, member, session } = useAuth();
  const myId = member?.id ?? null;
  const uid = session?.user.id ?? null;

  const [tab, setTab] = useState<TabId>("home");
  const [period, setPeriodState] = useState<PeriodId>("q3");
  const [calM, setCalM] = useState<number>(Math.min(Math.max(TODAY_M, 0), MONTHS.length - 1));

  const [raw, setRaw] = useState<RawData>(EMPTY_RAW);
  const rawRef = useRef(raw);
  rawRef.current = raw;

  const [recents, setRecents] = useState<string[]>(() => [...RECENTS]);
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
    if (!myId) return;
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
    if (!myId) return;
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

  const logToday = useCallback(async () => {
    if (!myId) return;
    const already = rawRef.current.workouts.some((w) => w.member_id === myId && w.workout_date === TODAY_ISO);
    setSheet({ mode: "log", doy: TODAY_DOY });
    if (already) return;
    setLogTick((t) => t + 1);
    setBounceTick((t) => t + 1);
    const res = await insertWorkout(TODAY_ISO);
    if (res.duplicate) showToast("Already on the record for today");
    else if (!res.ok) showToast("Couldn't log — try again");
  }, [myId, insertWorkout, showToast]);

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

  const reinsertDay = useCallback(
    async (doy: number) => {
      setBounceTick((t) => t + 1);
      const res = await insertWorkout(doyToIso(doy));
      if (res.ok) showToast("Restored");
      else showToast("Couldn't restore — try again");
    },
    [insertWorkout, showToast],
  );

  const removeDay = useCallback(
    async (doy: number) => {
      if (!myId) return;
      const iso = doyToIso(doy);
      const row = rawRef.current.workouts.find((w) => w.member_id === myId && w.workout_date === iso);
      setDaySheet(null);
      if (!row) return;
      const id = row.id;
      patchRaw((r) => ({
        ...r,
        workouts: r.workouts.filter((w) => w.id !== id),
        reactions: r.reactions.filter((x) => x.workout_id !== id),
        comments: r.comments.filter((x) => x.workout_id !== id),
      }));
      const m = monthOf(doy);
      pushToast(`Removed ${m.n.slice(0, 3)} ${doy - m.off}`, 4000, () => reinsertDay(doy));
      if (!id.startsWith("tmp-")) {
        const { error } = await supabase.from("workouts").delete().eq("id", id);
        if (error) {
          patchRaw((r) => ({ ...r, workouts: [...r.workouts, row] }));
          showToast("Couldn't delete — try again");
          return;
        }
      }
      scheduleRefetch();
    },
    [myId, supabase, patchRaw, pushToast, reinsertDay, showToast, scheduleRefetch],
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
      showToast(cur.mode === "log" ? "Details filed." : "Entry updated.");
      setSheet(null);

      // optimistic local patch
      patchRaw((r) => ({
        ...r,
        workouts: r.workouts.map((w) =>
          w.member_id === myId && w.workout_date === iso
            ? { ...w, types: detail.types, duration_min: minutes, note: detail.note || null, photo_path: detail.photo ? w.photo_path ?? "pending" : w.photo_path }
            : w,
        ),
      }));

      // resolve the real row id (a just-logged insert may still be in flight)
      const local = rawRef.current.workouts.find((w) => w.member_id === myId && w.workout_date === iso);
      let id = local && !local.id.startsWith("tmp-") ? local.id : null;
      if (!id) {
        const { data } = await supabase
          .from("workouts")
          .select("id")
          .eq("member_id", myId)
          .eq("workout_date", iso)
          .maybeSingle();
        id = (data?.id as string | undefined) ?? null;
      }
      if (!id) {
        scheduleRefetch();
        return;
      }

      let photoPath: string | null = null;
      if (file && uid) {
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${uid}/${id}-${Date.now()}.${ext}`;
        const up = await supabase.storage.from("proof").upload(path, file, {
          upsert: true,
          contentType: file.type || "image/jpeg",
        });
        if (!up.error) photoPath = path;
      }

      const update: Record<string, unknown> = {
        types: detail.types,
        duration_min: minutes,
        note: detail.note || null,
      };
      if (photoPath) update.photo_path = photoPath;
      const { error } = await supabase.from("workouts").update(update).eq("id", id);
      if (error) showToast("Couldn't save details");
      scheduleRefetch();
    },
    [sheet, myId, uid, supabase, patchRaw, showToast, scheduleRefetch],
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

  const demoLog = useCallback(() => {
    /* Demo affordance retired — real friend logs arrive via realtime. */
  }, []);

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
      flapTick: logTick + otherTick + periodTick,
      reorderTick: logTick + otherTick,
      toast,
      sheet,
      daySheet,
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
      demoLog,
      addRecent,
      showToast,
      clearToast,
      toggleLike,
      addComment,
    }),
    [
      tab, frens, me, period, calM, doneDoy, dayData, feed, recents, logged, bounceTick,
      logTick, otherTick, periodTick, toast, sheet, daySheet, setPeriod, prevMonth, nextMonth,
      logToday, backfillDay, removeDay, saveDetails, openSheet, closeSheet, openDaySheet,
      closeDaySheet, demoLog, addRecent, showToast, clearToast, toggleLike, addComment,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
