"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";
import { TODAY_ISO } from "./data";

/** Current DEVICE-local calendar date as YYYY-MM-DD (to detect a day rollover —
 *  also catches the date jumping when the device changes timezone). */
function localNowIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export interface ClaimedMember {
  id: string;
  display_name: string;
  is_admin: boolean;
  sheet_name: string;
  /** IANA zone stored for this member (synced from the device on every open). */
  timezone: string;
}

/** Keep the member's stored timezone in sync with the device — fire-and-forget,
 *  at most once per zone value per session. Runs on every successful member
 *  load (installed PWAs stay signed in for months, so hooking sign-in alone
 *  would never catch a fren who moved or is travelling). */
let tzSynced: string | null = null;
let tzRejected: string | null = null; // a zone Postgres refused — don't retry it
function syncTimezone(supabase: SupabaseClient, stored: string | undefined) {
  try {
    const device = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!device || device === stored || tzSynced === device || tzRejected === device) return;
    tzSynced = device;
    void supabase
      .rpc("set_my_timezone", { tz: device })
      .then(({ error }: { error: { message: string } | null }) => {
        if (error) {
          // A zone name Postgres doesn't know (browser/pg tzdata skew) — the
          // member keeps the stored zone; remember the rejection so we don't
          // refire the RPC on every visibility refresh.
          console.warn("timezone sync failed:", error.message);
          tzRejected = device;
          tzSynced = null;
        }
      });
  } catch {
    /* Intl unavailable — keep the stored zone */
  }
}

/** Reset the sync guard on sign-out so the next account on this tab re-syncs. */
function resetTzSync() {
  tzSynced = null;
}

/** loading → checking session; signedOut → no Google session; unclaimed →
 *  signed in but no members row; ready → claimed member. */
export type AuthPhase = "loading" | "signedOut" | "unclaimed" | "ready";

interface AuthCtx {
  supabase: SupabaseClient;
  session: Session | null;
  member: ClaimedMember | null;
  phase: AuthPhase;
  refresh: () => Promise<void>;
  refreshMember: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  /** Email OTP: send a 6-digit code to the address. */
  sendEmailOtp: (email: string) => Promise<{ error: string | null }>;
  /** Email OTP: verify the code and establish the session. */
  verifyEmailOtp: (email: string, token: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => getSupabase(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [member, setMember] = useState<ClaimedMember | null>(null);
  const [phase, setPhase] = useState<AuthPhase>("loading");

  // Reads my members row. Under RLS an unclaimed account gets 0 rows (not an
  // error), so an empty result means "not claimed yet".
  const loadMember = useCallback(
    async (s: Session | null) => {
      if (!s) {
        setMember(null);
        setPhase("signedOut");
        return;
      }
      // Retry a few times: right after an OTP verify the auth token can lag the
      // PostgREST request on some browsers (notably Safari), so a genuinely
      // claimed member reads back empty for a beat.
      let lastError: unknown = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data, error } = await supabase
          .from("members")
          .select("id, display_name, is_admin, sheet_name, timezone")
          .eq("user_id", s.user.id)
          .maybeSingle();
        if (data) {
          setMember(data as ClaimedMember);
          setPhase("ready");
          syncTimezone(supabase, (data as ClaimedMember).timezone);
          return;
        }
        lastError = error;
        if (attempt < 2) await new Promise((r) => setTimeout(r, 400));
      }
      // A network error must NOT drop a claimed user onto the claim screen —
      // leave the phase as-is and let the visibilitychange refresh retry. Only a
      // clean empty result (no error, after retries) means "not claimed yet".
      if (lastError) return;
      setMember(null);
      setPhase("unclaimed");
    },
    [supabase],
  );

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    await loadMember(data.session);
  }, [supabase, loadMember]);

  const refreshMember = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    await loadMember(data.session);
  }, [supabase, loadMember]);

  useEffect(() => {
    let active = true;
    // A cold launch — notably an iOS PWA relaunched by tapping a push
    // notification — can read a null session before the stored token / refresh
    // settles. Retry a few times before concluding "signed out", so a genuinely
    // signed-in fren isn't bounced to the login screen on a notification tap.
    (async () => {
      let { data } = await supabase.auth.getSession();
      for (let i = 0; i < 3 && !data.session; i++) {
        await new Promise((r) => setTimeout(r, 500));
        if (!active) return;
        data = (await supabase.auth.getSession()).data;
      }
      if (!active) return;
      setSession(data.session);
      loadMember(data.session);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!active) return;
      setSession(s);
      // Defer the DB read out of the auth callback — supabase-js warns that
      // awaiting a query inside onAuthStateChange can deadlock its auth lock.
      setTimeout(() => {
        if (active) loadMember(s);
      }, 0);
    });
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      // The date constants are computed once at module load; if the local day
      // rolled over while the PWA was backgrounded (midnight, or the device's
      // timezone changed in flight), they're stale — a full reload recomputes
      // them so "today" is correct and logs land right.
      if (localNowIso() !== TODAY_ISO) {
        window.location.reload();
        return;
      }
      refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    // The visibility handler never fires if the app sits in the FOREGROUND
    // across midnight (screen on at 11:59pm) — the stale date constants would
    // then credit a 12:05am log to yesterday, or block logging entirely
    // ("already on the record"). A minute tick catches that rollover too.
    const dayTick = window.setInterval(() => {
      if (localNowIso() !== TODAY_ISO) window.location.reload();
    }, 60_000);
    return () => {
      active = false;
      sub.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(dayTick);
    };
  }, [supabase, loadMember, refresh]);

  const signInWithGoogle = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }, [supabase]);

  const sendEmailOtp = useCallback(
    async (email: string) => {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser: true },
      });
      return { error: error?.message ?? null };
    },
    [supabase],
  );

  const verifyEmailOtp = useCallback(
    async (email: string, token: string) => {
      const e = email.trim().toLowerCase();
      const t = token.trim();
      // Existing accounts verify under "email"; brand-new ones created by the
      // OTP send sometimes verify under "signup". A wrong-type attempt doesn't
      // consume the code, so falling back is safe.
      let res = await supabase.auth.verifyOtp({ email: e, token: t, type: "email" });
      if (res.error) {
        const alt = await supabase.auth.verifyOtp({ email: e, token: t, type: "signup" });
        if (!alt.error) res = alt;
      }
      if (!res.error && res.data.session) {
        setSession(res.data.session);
        await loadMember(res.data.session);
      }
      return { error: res.error?.message ?? null };
    },
    [supabase, loadMember],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    resetTzSync(); // next account on this tab must sync its own zone
    setMember(null);
    setSession(null);
    setPhase("signedOut");
  }, [supabase]);

  const value = useMemo<AuthCtx>(
    () => ({
      supabase,
      session,
      member,
      phase,
      refresh,
      refreshMember,
      signInWithGoogle,
      sendEmailOtp,
      verifyEmailOtp,
      signOut,
    }),
    [
      supabase,
      session,
      member,
      phase,
      refresh,
      refreshMember,
      signInWithGoogle,
      sendEmailOtp,
      verifyEmailOtp,
      signOut,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
