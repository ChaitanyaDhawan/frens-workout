"use client";

import { useEffect, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { useAuth } from "@/app/lib/auth";
import { useStore } from "@/app/lib/store";

const SHEET_EASE: [number, number, number, number] = [0.3, 1.15, 0.35, 1];
const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

type Source = { key: string; name: string; icon: string; live?: boolean };
const SOURCES: Source[] = [
  { key: "apple", name: "Apple Watch", icon: "⌚", live: true },
  { key: "strava", name: "Strava", icon: "🏃" },
  { key: "fitbit", name: "Fitbit", icon: "🎯" },
  { key: "google", name: "Google Fit", icon: "🟢" },
  { key: "garmin", name: "Garmin", icon: "🧭" },
  { key: "whoop", name: "Whoop", icon: "🔴" },
];

// iOS 17+ flow: the "run without asking" choice now appears right after the
// trigger (it used to be "Ask Before Running" at the end), so it's its own step.
const STEPS: { title: string; body: ReactNode }[] = [
  { title: "Open Shortcuts", body: (<>Open <b>Shortcuts</b> → the <b>Automation</b> tab → tap <b>＋ New Automation</b>.</>) },
  { title: "Pick the trigger", body: (<>Scroll to <b>Apple Watch Workout</b> → choose <b>Any</b> workout, <b>Ends</b> → <b>Next</b>. <i>(This trigger only appears when an Apple Watch is paired.)</i></>) },
  { title: "Run it automatically", body: (<>Choose <b>Run Immediately</b> (not “After Confirmation”) so it never asks you each time → <b>Next</b>.</>) },
  { title: "Add your link", body: (<>Add <b>Get Contents of URL</b> → paste your link (Copy above) as the URL → <b>Done</b>. 🎉</>) },
];
const REMAIN = ["~2 min left", "~1 min left", "~30 sec left", "almost done!"];

/** Bottom sheet: a tile menu of auto-log sources; Apple Watch opens the setup. */
export default function AutoLogSheet() {
  const { supabase } = useAuth();
  const { closeAutoLog, showToast } = useStore();
  const [view, setView] = useState<"menu" | "apple">("menu");
  const [token, setToken] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  const [retry, setRetry] = useState(0);
  const [copied, setCopied] = useState(false);
  const [step, setStep] = useState(1);

  useEffect(() => {
    if (view !== "apple" || token) return;
    let active = true;
    setErr(false);
    (async () => {
      try {
        const { data, error } = await supabase.from("member_log_tokens").select("token").maybeSingle();
        if (!active) return;
        if (data?.token && !error) setToken(data.token as string);
        else setErr(true); // no row / RLS-empty / error → show a retry, never hang
      } catch {
        if (active) setErr(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [view, token, supabase, retry]);

  const link = token && SUPA ? `${SUPA}/functions/v1/log-workout?token=${token}` : "";
  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard blocked (non-secure context / iOS webview) — select for a manual copy
      const el = document.querySelector<HTMLInputElement>(".al-link");
      el?.focus();
      el?.select();
      showToast("Long-press the link to copy it");
    }
  };

  return (
    <motion.div
      className="sheet al-sheet"
      style={{ x: "-50%" }}
      initial={{ y: "105%" }}
      animate={{ y: 0 }}
      exit={{ y: "105%" }}
      transition={{ duration: 0.4, ease: SHEET_EASE }}
    >
      {view === "menu" ? (
        <>
          <div className="shead">
            <h2>⚡ Auto-logging</h2>
            <button className="al-x" onClick={closeAutoLog} aria-label="Close">
              ✕
            </button>
          </div>
          <div className="al-sheet-sub">Connect a tracker and your workouts log themselves.</div>
          <div className="al-grid">
            {SOURCES.map((s) => (
              <button
                key={s.key}
                className={`al-tile${s.live ? " live" : " soon"}`}
                disabled={!s.live}
                onClick={() => s.live && setView("apple")}
              >
                <span className="al-ico">{s.icon}</span>
                <span className="al-name">{s.name}</span>
                <span className="al-badge">{s.live ? "Set up ›" : "Soon"}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="shead al-head2">
            <button className="al-back" onClick={() => setView("menu")}>
              ‹ Back
            </button>
            <h2>⌚ Apple Watch</h2>
            <button className="al-x" onClick={closeAutoLog} aria-label="Close">
              ✕
            </button>
          </div>

          <div className="al-step-label">1. Copy your private link</div>
          {err ? (
            <div className="al-linkrow">
              <input className="al-link" readOnly value="Couldn’t load your link" />
              <button
                className="al-copy"
                onClick={() => {
                  setErr(false);
                  setRetry((r) => r + 1);
                }}
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="al-linkrow">
              <input
                className="al-link"
                readOnly
                value={token ? link : "Loading your link…"}
                onFocus={(e) => e.currentTarget.select()}
              />
              <button className="al-copy" onClick={copy} disabled={!token}>
                {copied ? "Copied ✓" : "Copy"}
              </button>
            </div>
          )}

          <div className="al-step-label">2. Set it up in Shortcuts</div>
          <div className="al-wiz">
            <div className="al-wiz-top">
              <span className="al-wiz-count">
                Step {step} of {STEPS.length} · {REMAIN[step - 1]}
              </span>
              <div className="al-wiz-dots">
                {STEPS.map((_, i) => (
                  <span key={i} className={`al-dot${i < step ? " on" : ""}`} />
                ))}
              </div>
            </div>
            <div className="al-wiz-title">{STEPS[step - 1].title}</div>
            <div className="al-wiz-body">{STEPS[step - 1].body}</div>
            <div className="al-wiz-nav">
              <button className="al-wiz-back" disabled={step === 1} onClick={() => setStep((s) => Math.max(1, s - 1))}>
                Back
              </button>
              {step < STEPS.length ? (
                <button className="al-wiz-next" onClick={() => setStep((s) => s + 1)}>
                  Next →
                </button>
              ) : (
                <button className="al-wiz-next" onClick={closeAutoLog}>
                  Done ✓
                </button>
              )}
            </div>
          </div>

          <div className="al-adv">
            Logs a plain workout for the day — open today’s entry in the app to add the activity or a note.
          </div>
        </>
      )}
    </motion.div>
  );
}
