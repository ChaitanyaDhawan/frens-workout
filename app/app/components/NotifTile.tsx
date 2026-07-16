"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/app/lib/auth";
import { useStore } from "@/app/lib/store";
import { enableNotifications, disableNotifications, notifState, hasPushSubscription, type NotifState } from "@/app/lib/push";

const META: Record<NotifState | "loading", { sub: string; pill: string; on: boolean }> = {
  loading: { sub: "Checking…", pill: "", on: false },
  on: { sub: "You’ll know the moment a fren logs", pill: "ON", on: true },
  off: { sub: "Tap to turn on — hear when frens log", pill: "OFF", on: false },
  blocked: { sub: "Blocked — turn on in device Settings", pill: "OFF", on: false },
  "needs-install": { sub: "Add to Home Screen first (iPhone)", pill: "OFF", on: false },
  unsupported: { sub: "Not available on this device", pill: "—", on: false },
};

/** You-tab tile showing notification status; tapping (when off) fires the system
 *  permission prompt and subscribes to push. */
export default function NotifTile() {
  const { supabase, member } = useAuth();
  const { showToast } = useStore();
  const [state, setState] = useState<NotifState | "loading">("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const s = notifState();
    if (s === "on") {
      // permission alone isn't enough — confirm a live subscription exists.
      hasPushSubscription().then((ok) => active && setState(ok ? "on" : "off"));
    } else {
      setState(s);
    }
    return () => {
      active = false;
    };
  }, []);

  const tap = async () => {
    if (busy || state === "loading") return;
    if (state === "on") {
      setBusy(true);
      await disableNotifications(supabase, member?.id ?? null);
      setBusy(false);
      setState("off");
      showToast("Notifications off");
      return;
    }
    if (state === "blocked") return showToast("Turn notifications on for FRENS in your device Settings");
    if (state === "needs-install") return showToast("Add FRENS to your Home Screen first, then turn these on");
    if (state === "unsupported") return showToast("Notifications aren’t supported on this device");
    setBusy(true);
    const res = await enableNotifications(supabase, member?.id ?? null);
    setBusy(false);
    setState(res);
    if (res === "on") showToast("Notifications on 🔔");
    else if (res === "blocked") showToast("You dismissed the prompt — turn it on in device Settings");
  };

  const meta = META[state];

  return (
    <button className="al-entry notif-tile" onClick={tap} disabled={busy || state === "loading"}>
      <span className="al-entry-ic">🔔</span>
      <span className="al-entry-tx">
        <span className="al-entry-t">Notifications</span>
        <span className="al-entry-s">{meta.sub}</span>
      </span>
      {meta.pill && <span className={`notif-pill${meta.on ? " on" : ""}`}>{busy ? "…" : meta.pill}</span>}
    </button>
  );
}
