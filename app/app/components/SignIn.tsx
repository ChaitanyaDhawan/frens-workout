"use client";

import { useState } from "react";
import { useAuth } from "@/app/lib/auth";

/** Signed-out screen — the app's paper/ink look with a Google button. */
export default function SignIn() {
  const { signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-eyebrow">Est. 2026 · 13 athletes</div>
        <div className="auth-mark">
          FRENS WORKOUT
        </div>
        <div className="auth-rule" />
        <p className="auth-sub">
          The friend-group workout ledger. Sign in to claim your name and start logging.
        </p>
        <button className="auth-google" onClick={onClick} disabled={busy}>
          {busy ? "Opening Google…" : "Continue with Google"}
        </button>
        <div className="auth-fine">Private group · invite only</div>
      </div>
    </div>
  );
}
