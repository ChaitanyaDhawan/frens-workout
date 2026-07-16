"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/app/lib/auth";

type Source = { key: string; name: string; icon: string; live?: boolean };

// Apple Watch is live; the rest are wired the same way later (OAuth + webhook).
const SOURCES: Source[] = [
  { key: "apple", name: "Apple Watch", icon: "⌚", live: true },
  { key: "strava", name: "Strava", icon: "🏃" },
  { key: "fitbit", name: "Fitbit", icon: "🎯" },
  { key: "google", name: "Google Fit", icon: "🟢" },
  { key: "garmin", name: "Garmin", icon: "🧭" },
  { key: "whoop", name: "Whoop", icon: "🔴" },
];

const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

// One tap per step. Kept deliberately short — the fiddly type+duration bits live
// in the optional "advanced" note, not the main flow.
const STEPS: { title: string; body: ReactNode }[] = [
  {
    title: "Open Shortcuts",
    body: (
      <>
        Open the <b>Shortcuts</b> app → tap the <b>Automation</b> tab at the bottom → tap <b>＋</b> (top
        right).
      </>
    ),
  },
  {
    title: "Choose the trigger",
    body: (
      <>
        Tap <b>Create Personal Automation</b> → scroll to <b>Workout</b> → pick <b>Any</b>, set{" "}
        <b>Is Ended</b> → <b>Next</b>.
      </>
    ),
  },
  {
    title: "Paste your link",
    body: (
      <>
        Tap <b>Add Action</b> → search <b>Get Contents of URL</b> → add it → <b>paste your link</b> (the
        Copy button above) as the URL.
      </>
    ),
  },
  {
    title: "Turn it on",
    body: (
      <>
        Tap <b>Next</b> → turn <b>off “Ask Before Running”</b> → <b>Done</b>. 🎉 Every workout now logs
        itself.
      </>
    ),
  },
];

/** "Auto-logging" — a grid of source tiles. Apple Watch opens a step-by-step
 *  wizard with the member's private log link; the rest say "Coming soon". */
export default function AutoLog() {
  const { supabase } = useAuth();
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [step, setStep] = useState(1);
  const [adv, setAdv] = useState(false);

  useEffect(() => {
    if (!open || token) return;
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
  }, [open, token, supabase]);

  const link = token ? `${SUPA}/functions/v1/log-workout?token=${token}` : "";
  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — the field is selectable as a fallback */
    }
  };

  const toggle = () => {
    setOpen((o) => !o);
    setStep(1);
  };

  return (
    <section className="al-wrap">
      <div className="al-eyebrow">⚡ Auto-logging</div>
      <div className="al-sub">Let your workouts log themselves.</div>

      <div className="al-grid">
        {SOURCES.map((s) => (
          <button
            key={s.key}
            className={`al-tile${s.live ? " live" : " soon"}${open && s.key === "apple" ? " sel" : ""}`}
            disabled={!s.live}
            onClick={() => s.live && toggle()}
          >
            <span className="al-ico">{s.icon}</span>
            <span className="al-name">{s.name}</span>
            <span className="al-badge">{s.live ? (open ? "Close" : "Set up") : "Soon"}</span>
          </button>
        ))}
      </div>

      {open && (
        <div className="al-card">
          <div className="al-card-h">⌚ Apple Watch auto-log</div>
          <div className="al-card-sub">Every workout that ends on your Watch logs itself here.</div>

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

          <div className="al-step-label">2. Set it up in Shortcuts · ~2 min</div>
          <div className="al-wiz">
            <div className="al-wiz-top">
              <span className="al-wiz-count">
                Step {step} of {STEPS.length}
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
                <button className="al-wiz-next" onClick={() => setOpen(false)}>
                  Done ✓
                </button>
              )}
            </div>
          </div>

          <button className="al-adv-toggle" onClick={() => setAdv((v) => !v)}>
            {adv ? "▾" : "▸"} Advanced: also capture the activity + duration
          </button>
          {adv && (
            <div className="al-adv">
              At <b>step 3</b>, after adding <b>Get Contents of URL</b>, tap the <b>▸</b> arrow → set{" "}
              <b>Method: POST</b>, <b>Request Body: JSON</b>, and add two fields: <b>type</b> = the{" "}
              <i>Workout Type</i> variable, <b>min</b> = the <i>Duration</i> variable. Then paste your link
              as the URL as usual.
            </div>
          )}

          <div className="al-tip">
            No Apple Watch? Open your link in any browser to log today — that’s exactly what the Watch does.
          </div>
        </div>
      )}
    </section>
  );
}
