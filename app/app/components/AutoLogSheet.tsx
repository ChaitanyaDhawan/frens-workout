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
  const [step, setStep] = useState(0); // 0 = intro screen, 1..7 = setup steps

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
            <button className="al-back" onClick={() => { setView("menu"); setStep(0); }}>
              ‹ Back
            </button>
            <h2>⌚ Apple Watch</h2>
            <button className="al-x" onClick={closeAutoLog} aria-label="Close">
              ✕
            </button>
          </div>

          {step === 0 ? (
            <div className="al-intro">
              <div className="al-intro-ic">⌚</div>
              <div className="al-intro-title">Auto-log every workout</div>
              <div className="al-intro-sub">
                Finish a workout on your Apple Watch and it logs itself here — you never have to open the app.
              </div>
              <div className="al-intro-facts">
                <div className="al-fact">
                  ⏱️ <b>~2 minutes, one time.</b> Set it up once and forget it.
                </div>
                <div className="al-fact">
                  🆓 <b>Free forever.</b> It runs on Apple’s own <b>Shortcuts</b> app, right on your iPhone —
                  nothing extra to install, sign up for, or pay.
                </div>
              </div>
              <button className="al-wiz-next al-start" onClick={() => setStep(1)}>
                Start setup →
              </button>
            </div>
          ) : (
            <>
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
                      <ol className="al-points">
                        <li>Tap <b>Get the shortcut</b> below.</li>
                        <li>When the <b>Shortcuts</b> app opens, tap <b>Add Shortcut</b>.</li>
                      </ol>
                      <a className="al-install" href={SHORTCUT_URL} target="_blank" rel="noopener noreferrer">
                        ⚡ Get the shortcut →
                      </a>
                    </>
                  )}
                  {step === 2 && (
                    <>
                      <ol className="al-points">
                        <li>Tap <b>Copy</b> to copy your private link.</li>
                        <li>You’ll paste it into the shortcut in the next step.</li>
                      </ol>
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
                    <ol className="al-points">
                      <li>Open the <b>Shortcuts</b> app.</li>
                      <li>Find <b>Log my FRENS workout</b> → tap the <b>⋯</b> on it to edit.</li>
                      <li>Tap the <b>URL</b> line and clear what’s there.</li>
                      <li><b>Paste</b> your link, then tap <b>Done</b>.</li>
                    </ol>
                  )}
                  {step === 4 && (
                    <ol className="al-points">
                      <li>In <b>Shortcuts</b>, tap the <b>Automation</b> tab at the bottom.</li>
                      <li>Tap <b>＋</b> at the top-right.</li>
                      <li>Tap <b>New Automation</b>.</li>
                    </ol>
                  )}
                  {step === 5 && (
                    <>
                      <ol className="al-points">
                        <li>Scroll down and tap <b>Apple Watch Workout</b>.</li>
                        <li>Set it to <b>Any</b> workout, <b>Ends</b>.</li>
                        <li>Tap <b>Next</b>.</li>
                      </ol>
                      <div className="al-note">Only shows if an Apple Watch is paired to your iPhone.</div>
                    </>
                  )}
                  {step === 6 && (
                    <ol className="al-points">
                      <li>Choose <b>Run Immediately</b> — not “After Confirmation”.</li>
                      <li>Tap <b>Next</b>.</li>
                    </ol>
                  )}
                  {step === 7 && (
                    <>
                      <ol className="al-points">
                        <li>Tap <b>Add Action</b>.</li>
                        <li>Search <b>Run Shortcut</b> and tap it.</li>
                        <li>Tap the blue <b>Shortcut</b> → choose <b>Log my FRENS workout</b>.</li>
                        <li>Tap <b>Done</b>.</li>
                      </ol>
                      <div className="al-done-note">🎉 That’s it — every Apple Watch workout now logs itself.</div>
                    </>
                  )}
                </div>
                <div className="al-wiz-nav">
                  <button className="al-wiz-back" onClick={() => setStep((s) => Math.max(0, s - 1))}>
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
                Logs the day’s workout — open today’s entry in the app to add the activity or a note.
              </div>
            </>
          )}
        </>
      )}
    </motion.div>
  );
}
