"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/app/lib/supabase";

/** OAuth redirect target. Completes the PKCE code exchange (client-side, since
 *  the code verifier lives in localStorage) then returns to the app. */
export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const supabase = getSupabase();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      router.replace("/");
    };

    (async () => {
      try {
        const code = new URLSearchParams(window.location.search).get("code");
        if (code) await supabase.auth.exchangeCodeForSession(code);
      } catch {
        // detectSessionInUrl may have already consumed the code — session is set.
      }
      finish();
    })();

    // Safety nets: proceed on sign-in event, and never hang here.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") finish();
    });
    const t = setTimeout(finish, 2500);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(t);
    };
  }, [router]);

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-mark">
          FRENS WORKOUT<i>.</i>
        </div>
        <div className="auth-loading">Signing you in…</div>
      </div>
    </div>
  );
}
