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

export interface ClaimedMember {
  id: string;
  display_name: string;
  is_admin: boolean;
  sheet_name: string;
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
      const { data, error } = await supabase
        .from("members")
        .select("id, display_name, is_admin, sheet_name")
        .eq("user_id", s.user.id)
        .maybeSingle();
      if (!error && data) {
        setMember(data as ClaimedMember);
        setPhase("ready");
      } else {
        setMember(null);
        setPhase("unclaimed");
      }
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
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      loadMember(data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!active) return;
      setSession(s);
      loadMember(s);
    });
    const onVis = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      active = false;
      sub.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [supabase, loadMember, refresh]);

  const signInWithGoogle = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }, [supabase]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setMember(null);
    setSession(null);
    setPhase("signedOut");
  }, [supabase]);

  const value = useMemo<AuthCtx>(
    () => ({ supabase, session, member, phase, refresh, refreshMember, signInWithGoogle, signOut }),
    [supabase, session, member, phase, refresh, refreshMember, signInWithGoogle, signOut],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
