"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/app/lib/auth";
import SignIn from "./SignIn";
import Claim from "./Claim";

function AuthSplash() {
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-eyebrow">Est. 2026</div>
        <div className="auth-mark">
          FRENS WORKOUT
        </div>
        <div className="auth-loading">Loading…</div>
      </div>
    </div>
  );
}

/** Switches between sign-in, name-claim, and the app based on auth phase. */
export default function AuthGate({ children }: { children: ReactNode }) {
  const { phase } = useAuth();
  if (phase === "loading") return <AuthSplash />;
  if (phase === "signedOut") return <SignIn />;
  if (phase === "unclaimed") return <Claim />;
  return <>{children}</>;
}
