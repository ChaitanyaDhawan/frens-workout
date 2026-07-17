"use client";

import { useEffect, useState } from "react";
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

// The ready-made shortcut (public iCloud link). It contains a single
// "Get Contents of URL" action with a placeholder URL and NO real token, so
// sharing it leaks nothing. Each fren imports it and pastes their own link over
// the placeholder — no building actions by hand.
const SHORTCUT_URL = "https://www.icloud.com/shortcuts/dbcef56d86394c5b9cbb83592f0f092e";

// One step per bottom-sheet screen (tap Next to advance) so each has room to be
// spelled out. The Apple Watch automation is the core — that's the whole point.
const TITLES = [
  "Get the shortcut",
  "Copy your link",
  "Paste your link in",
  "Start a new automation",
  "Choose the trigger",
  "Make it run silently",
  "Point it at your shortcut",
];
const REMAIN = ["~2 min left", "~90 sec left", "~75 sec left", "~1 min left", "~40 sec left", "~20 sec left", "almost done!"];
const TOTAL = TITLES.length;

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
            <button className="al-back" onClick={() => { setView("menu"); setStep(1); }}>
              ‹ Back
            </button>
            <h2>⌚ Apple Watch</h2>
            <button className="al-x" onClick={closeAutoLog} aria-label="Close">
              ✕
            </button>
          </div>

          <div className="al-sheet-sub">Every Apple Watch workout logs itself. One-time setup — just tap through.</div>

          <div className="al-wiz">
            <div className="al-wiz-top">
              <span className="al-wiz-count">
                Step {step} of {TOTAL} · {REMAIN[step - 1]}
              </span>
              <div className="al-wiz-dots">
                {Array.from({ length: TOTAL }).map((_, i) => (
                  <span key={i} className={`al-dot${i < step ? " on" : ""}`} />
                ))}
              </div>
            </div>
            <div className="al-wiz-title">{TITLES[step - 1]}</div>
            <div className="al-wiz-body">
              {step === 1 && (
                <>
                  Tap the button below. When the <b>Shortcuts</b> app opens, tap <b>Add Shortcut</b> to save it.
                  <a className="al-install" href={SHORTCUT_URL} target="_blank" rel="noopener noreferrer">
                    ⚡ Get the shortcut →
                  </a>
                </>
              )}
              {step === 2 && (
                <>
                  Tap <b>Copy</b> to copy your own private logging link — you’ll paste it into the shortcut next.
                  {err ? (
                    <div className="al-linkrow">
                      <input className="al-link" readOnly value="Couldn’t load your link" />
                      <button className="al-copy" onClick={() => { setErr(false); setRetry((r) => r + 1); }}>
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
                </>
              )}
              {step === 3 && (
                <>
                  Open the <b>Shortcuts</b> app. Find <b>Log my FRENS workout</b> and tap the <b>⋯</b> in its
                  top-right corner to edit it. Tap the <b>URL</b> line, delete what’s there, and <b>paste</b> your
                  link. Tap <b>Done</b> (top-right).
                </>
              )}
              {step === 4 && (
                <>
                  Still in <b>Shortcuts</b>, tap the <b>Automation</b> tab at the bottom → tap <b>＋</b> (top-right)
                  → <b>New Automation</b>.
                </>
              )}
              {step === 5 && (
                <>
                  Scroll down and tap <b>Apple Watch Workout</b>. Set it to <b>Any</b> workout, <b>Ends</b>, then
                  tap <b>Next</b>. <i>(This only appears if an Apple Watch is paired to your iPhone.)</i>
                </>
              )}
              {step === 6 && (
                <>
                  Choose <b>Run Immediately</b> (not “After Confirmation”) so it never asks you each time → tap
                  <b> Next</b>.
                </>
              )}
              {step === 7 && (
                <>
                  Tap <b>Add Action</b> → search <b>Run Shortcut</b> → tap it → tap the blue <b>Shortcut</b> →
                  choose <b>Log my FRENS workout</b> → <b>Done</b>. 🎉 Every Apple Watch workout now logs itself.
                </>
              )}
            </div>
            <div className="al-wiz-nav">
              <button className="al-wiz-back" disabled={step === 1} onClick={() => setStep((s) => Math.max(1, s - 1))}>
                Back
              </button>
              {step < TOTAL ? (
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
