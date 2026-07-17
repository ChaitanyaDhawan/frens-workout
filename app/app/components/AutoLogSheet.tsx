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

/** Bottom sheet: a tile menu of auto-log sources; Apple Watch opens the setup. */
export default function AutoLogSheet() {
  const { supabase } = useAuth();
  const { closeAutoLog, showToast } = useStore();
  const [view, setView] = useState<"menu" | "apple">("menu");
  const [token, setToken] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  const [retry, setRetry] = useState(0);
  const [copied, setCopied] = useState(false);

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

          <div className="al-step-label">2. Install the ready-made shortcut</div>
          <a className="al-install" href={SHORTCUT_URL} target="_blank" rel="noopener noreferrer">
            ⚡ Get the shortcut →
          </a>
          <div className="al-hint">Tap <b>Add Shortcut</b> when iOS asks.</div>

          <div className="al-step-label">3. Paste your link into it</div>
          <div className="al-hint">
            Open the shortcut, tap the <b>URL</b>, and paste your link (Copy above) over the placeholder. Tap the
            shortcut once to test — it logs today ✓
          </div>

          <div className="al-step-label">
            4. Hands-free on Apple Watch <span className="al-opt">optional</span>
          </div>
          <div className="al-hint">
            Shortcuts → <b>Automation</b> → <b>New Automation</b> → <b>Apple Watch Workout</b> → Any, Ends → Run
            Immediately → <b>Run Shortcut</b> → “Log my FRENS workout”.
          </div>

          <div className="al-adv">
            Logs a plain workout for the day — open today’s entry in the app to add the activity or a note.
          </div>
        </>
      )}
    </motion.div>
  );
}
