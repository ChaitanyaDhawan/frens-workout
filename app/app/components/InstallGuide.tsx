"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  getDeferredPrompt,
  getInstallPlatform,
  promptInstall,
  subscribeInstallState,
  wasInstalled,
  type InstallPlatform,
} from "@/app/lib/push";

function ShareIcon() {
  return (
    <svg className="ig-share" width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3v11M12 3 8.5 6.5M12 3l3.5 3.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 11H5a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7a1 1 0 0 0-1-1h-1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function stepsFor(platform: InstallPlatform): ReactNode[] {
  switch (platform) {
    case "ios-safari":
      return [
        <>
          Tap the <b>⋯</b> (three dots) in Safari&apos;s toolbar
        </>,
        <>
          Tap <ShareIcon /> <b>Share</b> → <b>scroll down</b> → <b>Add to Home Screen</b>
        </>,
        <>
          Tap <b>Add</b>
        </>,
      ];
    case "ios-other":
      return [
        <>
          Open this page in <b>Safari</b>
        </>,
        <>
          Tap the <b>⋯</b> (three dots) in the toolbar
        </>,
        <>
          Tap <ShareIcon /> <b>Share</b> → <b>scroll down</b> → <b>Add to Home Screen</b>
        </>,
      ];
    case "android-chrome":
      return [
        <>
          Open the <b>⋮</b> menu
        </>,
        <>
          Tap <b>Install app</b>
        </>,
        <>Confirm</>,
      ];
    case "desktop":
      return [
        <>
          Click the <b>install icon</b> in the address bar
        </>,
        <>
          …or <b>⋮</b> menu → <b>Install</b>
        </>,
        <>Confirm</>,
      ];
    default:
      return [
        <>
          Open the browser <b>menu</b>
        </>,
        <>
          Tap <b>Add to Home screen</b>
        </>,
        <>Confirm</>,
      ];
  }
}

/**
 * Dismissible install helper. Renders nothing only when already installed
 * (standalone). On every other environment (mobile + desktop) it slides up a
 * bottom sheet with the right steps. Dismissal is for the current load only —
 * it comes back on the next open, by design (no permanent "never show again").
 */
// Desktop never gets the install nag — just a soft "it's better on your phone"
// note, shown at most once a week.
const DESKTOP_NOTE_KEY = "frens_desktop_note_ts";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default function InstallGuide() {
  const [platform, setPlatform] = useState<InstallPlatform>("standalone");
  const [hasPrompt, setHasPrompt] = useState(false);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [suppressed, setSuppressed] = useState(false);

  // Resolve environment on the client only (keeps SSR output = null).
  useEffect(() => {
    const p = getInstallPlatform();
    setPlatform(p);
    setHasPrompt(!!getDeferredPrompt());
    if (p === "desktop") {
      try {
        const last = Number(localStorage.getItem(DESKTOP_NOTE_KEY) || 0);
        if (Date.now() - last < WEEK_MS) setSuppressed(true);
      } catch {
        /* localStorage blocked — fall through and show once */
      }
    }
    const unsub = subscribeInstallState(() => {
      setHasPrompt(!!getDeferredPrompt());
      if (wasInstalled()) setOpen(false);
    });
    return unsub;
  }, []);

  const eligible = platform !== "standalone" && !dismissed && !suppressed;
  const isDesktop = platform === "desktop";

  // Slide in after a short beat so the first paint stays clean.
  useEffect(() => {
    if (!eligible) return;
    const t = setTimeout(() => {
      setOpen(true);
      // Stamp the weekly cooldown the moment the desktop note actually shows.
      if (isDesktop) {
        try {
          localStorage.setItem(DESKTOP_NOTE_KEY, String(Date.now()));
        } catch {
          /* ignore */
        }
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [eligible, isDesktop]);

  if (!eligible) return null;

  // Close for this load only — it returns on the next app open.
  const close = () => {
    setOpen(false);
    setTimeout(() => setDismissed(true), 350);
  };

  const onInstall = async () => {
    const outcome = await promptInstall();
    if (outcome === "accepted" || outcome === "unavailable") close();
  };

  // Desktop: a gentle, weekly nudge toward the phone — no install steps, no button.
  if (isDesktop) {
    return (
      <>
        <div className={`ig-scrim${open ? " show" : ""}`} onClick={close} />
        <div
          className={`ig-sheet${open ? " show" : ""}`}
          role="dialog"
          aria-modal="false"
          aria-label="FRENS on your phone"
        >
          <div className="ig-eyebrow">Heads up</div>
          <div className="ig-title">Best on your phone</div>
          <div className="ig-sub">
            FRENS works right here in your browser — but it really shines installed on your
            phone: one-tap logging and a nudge the moment a fren works out.
          </div>
          <button className="ig-dismiss" onClick={close}>
            Got it — keep using it here
          </button>
        </div>
      </>
    );
  }

  const showNativeButton = platform === "android-chrome" && hasPrompt;
  const steps = stepsFor(platform);

  return (
    <>
      <div className={`ig-scrim${open ? " show" : ""}`} onClick={close} />
      <div className={`ig-sheet${open ? " show" : ""}`} role="dialog" aria-modal="false" aria-label="Install FRENS">
        <div className="ig-eyebrow">Add to home screen</div>
        <div className="ig-title">Install FRENS</div>
        <div className="ig-sub">
          Faster and full-screen — and the only way to get notified the moment a fren logs a workout.
        </div>

        {showNativeButton ? (
          <button className="ig-install-btn" onClick={onInstall}>
            Install FRENS
          </button>
        ) : (
          <ol className="ig-steps">
            {steps.map((node, i) => (
              <li key={i} className="ig-step">
                <span className="ig-step-n">{i + 1}</span>
                <span className="ig-step-tx">{node}</span>
              </li>
            ))}
          </ol>
        )}

        <button className="ig-dismiss" onClick={close}>
          Continue in browser for now
        </button>
      </div>
    </>
  );
}
