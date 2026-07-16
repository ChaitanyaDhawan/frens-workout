"use client";

import { useEffect, useState } from "react";
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

/** "Auto-logging" — a grid of source tiles. Apple Watch opens a setup card with
 *  the member's private log link + iOS Shortcut steps; the rest say "Coming soon". */
export default function AutoLog() {
  const { supabase } = useAuth();
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showSteps, setShowSteps] = useState(false);

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
            onClick={() => s.live && setOpen((o) => !o)}
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
          <div className="al-card-sub">
            Every workout that ends on your Watch logs itself here — with the activity and duration.
          </div>

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

          <button className="al-steps-toggle" onClick={() => setShowSteps((v) => !v)}>
            {showSteps ? "▾" : "▸"} How to set it up (iPhone · 1 min)
          </button>
          {showSteps && (
            <ol className="al-steps">
              <li>
                Open <b>Shortcuts</b> → <b>Automation</b> → <b>+</b> → <b>Create Personal Automation</b>.
              </li>
              <li>
                Scroll to <b>Workout</b> → pick <b>Any</b>, <b>Is Ended</b> → <b>Next</b>.
              </li>
              <li>
                Add <b>Get Contents of URL</b> → tap ▸ → <b>Method: POST</b>, <b>Request Body: JSON</b>.
              </li>
              <li>
                Add two fields — <b>type</b> = the <i>Workout Type</i> variable, <b>min</b> = the{" "}
                <i>Duration</i> variable.
              </li>
              <li>
                Paste your link above as the URL → <b>Next</b> → turn off <b>“Ask Before Running”</b> →{" "}
                <b>Done</b>.
              </li>
            </ol>
          )}

          <div className="al-tip">
            No Apple Watch? Open your link in any browser to log today — that’s exactly what the Watch does.
          </div>
        </div>
      )}
    </section>
  );
}
