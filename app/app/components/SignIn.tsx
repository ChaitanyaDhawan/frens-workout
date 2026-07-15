"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/app/lib/auth";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Custom SMTP (Gmail) is wired in Supabase, so the 6-digit code email works.
const OTP_ENABLED = true;
// Google sign-in is kept in the code but hidden from the UI — email OTP is the
// single way in. Flip back to true to restore the button.
const GOOGLE_ENABLED = false;

/** Signed-out screen — email OTP (primary) with Google as a secondary option. */
export default function SignIn() {
  const { signInWithGoogle, sendEmailOtp, verifyEmailOtp } = useAuth();
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  // Focus the code field the moment the code screen shows, so the keyboard opens.
  useEffect(() => {
    if (stage === "code") codeRef.current?.focus();
  }, [stage]);

  const onGoogle = async () => {
    setBusy(true);
    setErr(null);
    try {
      await signInWithGoogle();
    } catch {
      setBusy(false);
    }
  };

  const onSend = () => {
    const e = email.trim();
    if (!EMAIL_RE.test(e)) {
      setErr("Enter a valid email address.");
      return;
    }
    setErr(null);
    // Switch to the code screen inside the tap gesture so the field can take
    // focus and open the keyboard on iOS; send the code in the background.
    setStage("code");
    setBusy(true);
    sendEmailOtp(e).then(({ error }) => {
      setBusy(false);
      if (error) setErr(error);
    });
  };

  const onVerify = async () => {
    const c = code.trim();
    if (c.length < 6) {
      setErr("Enter the 6-digit code from your email.");
      return;
    }
    setBusy(true);
    setErr(null);
    const { error } = await verifyEmailOtp(email.trim(), c);
    setBusy(false);
    if (error) {
      setErr("That code didn't work — check it or resend.");
    }
    // On success, onAuthStateChange advances the gate to claim/app.
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-eyebrow">Est. 2025 · 13 athletes</div>
        <div className="auth-mark">FRENS WORKOUT</div>
        <div className="auth-rule" />
        <p className="auth-sub">The friend-group workout ledger. Sign in to claim your name and start logging.</p>

        {OTP_ENABLED && (
          <>
        {stage === "email" ? (
          <>
            <input
              className="auth-input"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSend();
              }}
            />
            <button className="auth-primary" onClick={onSend} disabled={busy}>
              {busy ? "Sending code…" : "Sign in"}
            </button>
          </>
        ) : (
          <>
            <p className="auth-code-note">
              Enter the 6-digit code sent to <b>{email.trim()}</b>
            </p>
            <input
              ref={codeRef}
              autoFocus
              className="auth-input auth-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="••••••"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(e) => {
                if (e.key === "Enter") onVerify();
              }}
            />
            <button className="auth-primary" onClick={onVerify} disabled={busy}>
              {busy ? "Verifying…" : "Verify & continue"}
            </button>
            <button
              className="auth-link"
              onClick={() => {
                setStage("email");
                setCode("");
                setErr(null);
              }}
            >
              Use a different email
            </button>
          </>
        )}

            {err && <div className="auth-err">{err}</div>}
          </>
        )}
        {GOOGLE_ENABLED && (
          <>
            {OTP_ENABLED && (
              <div className="auth-or">
                <span>or</span>
              </div>
            )}
            <button className={`auth-google${OTP_ENABLED ? "" : " solo"}`} onClick={onGoogle} disabled={busy}>
              {busy ? "Opening Google…" : "Continue with Google"}
            </button>
          </>
        )}
        <div className="auth-fine">Private group · invite only</div>
      </div>
    </div>
  );
}
