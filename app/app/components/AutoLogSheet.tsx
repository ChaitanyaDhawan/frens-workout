"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useAuth } from "@/app/lib/auth";
import { useStore } from "@/app/lib/store";
import { initials } from "@/app/lib/helpers";

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
const SOURCE_BY_KEY: Record<string, Source> = Object.fromEntries(SOURCES.map((s) => [s.key, s]));

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

// A short intro storyline shown before the setup steps — one beat per screen.
const INTROS: { ic: string; title: string; body: string }[] = [
  { ic: "⌚", title: "It logs your workouts for you", body: "Finish a workout on your Apple Watch and it shows up here on its own. You never have to open the app." },
  { ic: "⏱️", title: "A 2-minute setup, just once", body: "Set it up one time and it runs by itself after that — on every workout, automatically." },
  { ic: "💛", title: "This is what keeps FRENS free", body: "It runs on Apple’s own Shortcuts, right on your phone — not on paid servers watching you. Those 2 minutes are the trade that keeps the app free for everyone." },
];

/** Bottom sheet: a tile menu of auto-log sources; Apple Watch opens the setup. */
export default function AutoLogSheet() {
  const { supabase } = useAuth();
  const { closeAutoLog, showToast, requestsBySource, myRequests, toggleIntegrationRequest } = useStore();
  const [view, setView] = useState<"menu" | "apple" | "request">("menu");
  const [reqSource, setReqSource] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  const [retry, setRetry] = useState(0);
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<"intro" | "setup" | "done">("intro");
  const [introI, setIntroI] = useState(0); // which intro-story screen
  const [step, setStep] = useState(1); // setup step 1..7

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
      <button className="sheet-x" onClick={closeAutoLog} aria-label="Close">
        ✕
      </button>
      {view === "menu" ? (
        <>
          <div className="shead">
            <h2>⚡ Auto-logging</h2>
          </div>
          <div className="al-sheet-sub">Apple Watch is live. Tap any other to request it next.</div>
          <div className="al-grid">
            {SOURCES.map((s) => {
              const voters = requestsBySource[s.key] ?? [];
              const mine = myRequests.has(s.key);
              const n = voters.length;
              // Top-right marker: a clear "Request" hint when untouched, and a
              // quiet count once people are asking — never louder than the live tile.
              const corner = s.live ? null : mine ? "✓ Requested" : n > 0 ? `${n} requested` : "Request";
              return (
                <button
                  key={s.key}
                  className={
                    `al-tile${s.live ? " live" : " soon"}` +
                    (!s.live && n > 0 ? " active" : "") +
                    (mine ? " requested" : "")
                  }
                  onClick={() => {
                    if (s.live) {
                      setView("apple");
                    } else {
                      setReqSource(s.key);
                      setView("request");
                    }
                  }}
                >
                  {corner && <span className={`al-corner${n > 0 ? " on" : ""}`}>{corner}</span>}
                  <span className="al-ico">{s.icon}</span>
                  <span className="al-name">{s.name}</span>
                  <span className="al-badge">{s.live ? "Set up ›" : "Coming soon"}</span>
                </button>
              );
            })}
          </div>
        </>
      ) : view === "request" ? (
        (() => {
          const src = reqSource ? SOURCE_BY_KEY[reqSource] : null;
          if (!src) return null;
          const voters = requestsBySource[src.key] ?? [];
          const mine = myRequests.has(src.key);
          const n = voters.length;
          return (
            <>
              <div className="shead al-head2">
                <button className="al-back" onClick={() => { setView("menu"); setReqSource(null); }}>
                  ‹ Back
                </button>
                <h2>{src.icon} {src.name}</h2>
                <span className="al-head2-sp" aria-hidden="true" />
              </div>

              <div className="al-intro al-req">
                <div className="al-intro-main">
                  <div className="al-intro-ic">{src.icon}</div>
                  <div className="al-intro-title">{src.name} integration isn’t here yet</div>
                  <div className="al-intro-sub">
                    We build these in the order FRENS request them. Add your name and {src.name} moves up the list.
                  </div>
                </div>

                {n > 0 && (
                  <div className="al-req-who">
                    <div className="al-req-wholabel">
                      <span>Requested by</span>
                      <span className="al-req-count">{n}</span>
                    </div>
                    <div className="al-req-voters">
                      {voters.map((v) => (
                        <div className={`al-req-voter${v.you ? " you" : ""}`} key={v.memberId}>
                          <span className="al-req-ava">{initials(v.name)}</span>
                          <span className="al-req-vname">{v.you ? "You" : v.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  className={`al-req-btn${mine ? " on" : ""}`}
                  onClick={() => toggleIntegrationRequest(src.key, !mine)}
                >
                  {mine ? "✓ You requested this · tap to undo" : `Request ${src.name} →`}
                </button>
              </div>
            </>
          );
        })()
      ) : (
        <>
          <div className="shead al-head2">
            <button
              className="al-back"
              onClick={() => { setView("menu"); setMode("intro"); setIntroI(0); setStep(1); }}
            >
              ‹ Back
            </button>
            <h2>⌚ Apple Watch</h2>
            <span className="al-head2-sp" aria-hidden="true" />
          </div>

          {mode === "intro" ? (
            <div className="al-intro">
              <div className="al-intro-main">
                <div className="al-intro-ic">{INTROS[introI].ic}</div>
                <div className="al-intro-title">{INTROS[introI].title}</div>
                <div className="al-intro-sub">{INTROS[introI].body}</div>
              </div>
              <div className="al-intro-dots">
                {INTROS.map((_, i) => (
                  <span key={i} className={`al-dot${i <= introI ? " on" : ""}`} />
                ))}
              </div>
              <div className="al-wiz-nav">
                <button
                  className="al-wiz-back"
                  onClick={() => (introI === 0 ? setView("menu") : setIntroI((i) => i - 1))}
                >
                  Back
                </button>
                {introI < INTROS.length - 1 ? (
                  <button className="al-wiz-next" onClick={() => setIntroI((i) => i + 1)}>
                    Next →
                  </button>
                ) : (
                  <button className="al-wiz-next" onClick={() => setMode("setup")}>
                    Start setup →
                  </button>
                )}
              </div>
            </div>
          ) : mode === "done" ? (
            <div className="al-intro al-done-screen">
              <div className="al-intro-main">
                <div className="al-intro-ic">🎉</div>
                <div className="al-intro-title">You’re all set</div>
                <div className="al-intro-sub">Here’s what happens now:</div>
                <ul className="al-done-list">
                  <li>Finish any Apple Watch workout and it logs here on its own.</li>
                  <li>You’ll get a notification each time one is auto-added.</li>
                  <li>Want to set the activity type? Just open the app and tap the entry.</li>
                </ul>
              </div>
              <div className="al-wiz-nav">
                <button className="al-wiz-back" onClick={() => setMode("setup")}>
                  Back
                </button>
                <button className="al-wiz-next" onClick={closeAutoLog}>
                  Got it ✓
                </button>
              </div>
            </div>
          ) : (
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
                  <ol className="al-points">
                    <li>Tap <b>Add Action</b>.</li>
                    <li>Search <b>Run Shortcut</b> and tap it.</li>
                    <li>Tap the blue <b>Shortcut</b> → choose <b>Log my FRENS workout</b>.</li>
                    <li>Tap <b>Done</b>.</li>
                  </ol>
                )}
              </div>
              <div className="al-wiz-nav">
                <button
                  className="al-wiz-back"
                  onClick={() => (step === 1 ? setMode("intro") : setStep((s) => Math.max(1, s - 1)))}
                >
                  Back
                </button>
                {step < TOTAL ? (
                  <button
                    className={`al-wiz-next${step === 1 || step === 2 ? " secondary" : ""}`}
                    onClick={() => setStep((s) => s + 1)}
                  >
                    Next →
                  </button>
                ) : (
                  <button className="al-wiz-next" onClick={() => setMode("done")}>
                    Done ✓
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}
