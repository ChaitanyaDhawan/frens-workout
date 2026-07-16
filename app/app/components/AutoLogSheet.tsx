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

const STEPS: { title: string; body: ReactNode }[] = [
  { title: "Open Shortcuts", body: (<>Open the <b>Shortcuts</b> app → tap the <b>Automation</b> tab → tap <b>＋</b>.</>) },
  { title: "Choose the trigger", body: (<>Tap <b>Create Personal Automation</b> → <b>Workout</b> → <b>Any</b>, <b>Is Ended</b> → <b>Next</b>.</>) },
  { title: "Paste your link", body: (<>Add <b>Get Contents of URL</b> → paste your link (Copy above) as the URL.</>) },
  { title: "Turn it on", body: (<>Tap <b>Next</b> → turn off <b>“Ask Before Running”</b> → <b>Done</b>. 🎉</>) },
];
const REMAIN = ["~2 min left", "~1 min left", "~30 sec left", "almost done!"];

/** Bottom sheet: a tile menu of auto-log sources; Apple Watch opens the setup. */
export default function AutoLogSheet() {
  const { supabase } = useAuth();
  const { closeAutoLog } = useStore();
  const [view, setView] = useState<"menu" | "apple">("menu");
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [step, setStep] = useState(1);
  const [adv, setAdv] = useState(false);

  useEffect(() => {
    if (view !== "apple" || token) return;
    let active = true;
    supabase
      .from("member_log_tokens")
      .select("token")
      .maybeSingle()
      .then(({ data }) => {
        if (active && data?.token) setToken(data.token as string);
      });
    return () => {
      active = false;
    };
  }, [view, token, supabase]);

  const link = token ? `${SUPA}/functions/v1/log-workout?token=${token}` : "";
  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — field is selectable */
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
            {step === 3 && (
              <div className="al-adv-wrap">
                <button className="al-adv-toggle" onClick={() => setAdv((v) => !v)}>
                  {adv ? "▾" : "▸"} Advanced: also capture the activity + duration
                </button>
                {adv && (
                  <div className="al-adv">
                    Before pasting the link, tap the <b>▸</b> arrow on <b>Get Contents of URL</b> → set{" "}
                    <b>Method: POST</b>, <b>Request Body: JSON</b>, and add two fields: <b>type</b> = the{" "}
                    <i>Workout Type</i> variable, <b>min</b> = the <i>Duration</i> variable.
                  </div>
                )}
              </div>
            )}
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
        </>
      )}
    </motion.div>
  );
}
