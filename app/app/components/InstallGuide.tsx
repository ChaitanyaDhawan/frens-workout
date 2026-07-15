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

const DISMISS_KEY = "frens_install_dismissed";

function ShareIcon() {
  return (
    <svg
      className="ig-share"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
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
          Tap <ShareIcon /> <b>Share</b> in Safari&apos;s toolbar
        </>,
        <>
          Choose <b>&ldquo;Add to Home Screen&rdquo;</b>
        </>,
        <>
          Tap <b>Add</b> — FRENS lands on your home screen
        </>,
      ];
    case "ios-other":
      return [
        <>
          Open this page in <b>Safari</b>
        </>,
        <>
          Tap <ShareIcon /> <b>Share</b> → <b>&ldquo;Add to Home Screen&rdquo;</b>
        </>,
        <>
          Tap <b>Add</b>
        </>,
      ];
    case "android-chrome":
      return [
        <>
          Open the browser menu <b>⋮</b> (top-right)
        </>,
        <>
          Tap <b>&ldquo;Install app&rdquo;</b> or <b>&ldquo;Add to Home screen&rdquo;</b>
        </>,
        <>Confirm — FRENS installs like an app</>,
      ];
    default:
      return [
        <>Open the browser menu</>,
        <>
          Tap <b>&ldquo;Add to Home screen&rdquo;</b>
        </>,
        <>Confirm to install</>,
      ];
  }
}

/**
 * One-time, dismissible install helper. Renders nothing when already installed
 * (standalone) or on desktop; on a mobile browser it slides up a bottom sheet
 * with the right Add-to-Home-Screen steps, matching the app's paper/ink look.
 */
export default function InstallGuide() {
  const [platform, setPlatform] = useState<InstallPlatform>("standalone");
  const [hasPrompt, setHasPrompt] = useState(false);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  // Resolve environment on the client only (keeps SSR output = null).
  useEffect(() => {
    setPlatform(getInstallPlatform());
    let already = false;
    try {
      already = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      already = false;
    }
    setDismissed(already);
    setHasPrompt(!!getDeferredPrompt());
    const unsub = subscribeInstallState(() => {
      setHasPrompt(!!getDeferredPrompt());
      if (wasInstalled()) setOpen(false);
    });
    return unsub;
  }, []);

  const eligible = platform !== "standalone" && platform !== "desktop" && !dismissed;

  // Slide in after a short beat so the first paint stays clean.
  useEffect(() => {
    if (!eligible) return;
    const t = setTimeout(() => setOpen(true), 1500);
    return () => clearTimeout(t);
  }, [eligible]);

  if (!eligible) return null;

  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    // Drop out of the tree once the slide-out finishes.
    setTimeout(() => setDismissed(true), 350);
  };

  const onInstall = async () => {
    const outcome = await promptInstall();
    if (outcome === "accepted" || outcome === "unavailable") close();
  };

  const showNativeButton = platform === "android-chrome" && hasPrompt;
  const steps = stepsFor(platform);

  return (
    <>
      <div className={`ig-scrim${open ? " show" : ""}`} onClick={close} />
      <div
        className={`ig-sheet${open ? " show" : ""}`}
        role="dialog"
        aria-modal="false"
        aria-label="Install FRENS"
      >
        <div className="ig-eyebrow">Add to home screen</div>
        <div className="ig-title">
          Install FRENS<i>.</i>
        </div>
        <div className="ig-sub">
          Faster, full-screen, and the only way to get streak nudges from your frens.
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
          Continue in browser anyway
        </button>
      </div>
    </>
  );
}
