"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/app/lib/auth";
import { maybeSubscribeAfterLog, isIOS, isStandalone } from "@/app/lib/push";

const DISMISS_KEY = "frens_notif_dismissed";

/** Gentle, early opt-in for push — appears right after you're in (claimed), so
 *  you're subscribed well before your first log. Gesture-driven (the Enable tap
 *  satisfies the browser's permission-prompt requirement). */
export default function NotificationPrompt() {
  const { supabase, member } = useAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !member) return;
    if (!("Notification" in window) || !("PushManager" in window) || !("serviceWorker" in navigator)) return;
    if (isIOS() && !isStandalone()) return; // iOS push only works in the installed PWA
    if (Notification.permission !== "default") return; // already granted or denied
    try {
      if (sessionStorage.getItem(DISMISS_KEY)) return;
    } catch {
      /* ignore */
    }
    const t = setTimeout(() => setShow(true), 1200);
    return () => clearTimeout(t);
  }, [member]);

  if (!show) return null;

  const enable = async () => {
    setShow(false);
    await maybeSubscribeAfterLog(supabase, member?.id ?? null);
  };
  const later = () => {
    setShow(false);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="notif-prompt" role="dialog" aria-label="Enable notifications">
      <div className="notif-tx">
        <b>Get notified 🔔</b>
        <span>Know the moment a fren logs a workout — and when they kudos yours.</span>
      </div>
      <div className="notif-btns">
        <button className="notif-enable" onClick={enable}>
          Enable
        </button>
        <button className="notif-later" onClick={later}>
          Later
        </button>
      </div>
    </div>
  );
}
