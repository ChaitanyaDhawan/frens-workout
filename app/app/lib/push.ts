"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

// Safe to embed in the client — this is the VAPID *public* key.
const VAPID_PUBLIC_KEY =
  "BMOFFhg-VwDzanw6BljpKCLzi4ZVUSrpllT2FnXNRrDRcf-SI1zvkKMyIe8BvL-cOWNKrZczlG6A5vxqaJ-ozQ8";

// ---------------------------------------------------------------------------
// Environment detection
// ---------------------------------------------------------------------------

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const displayMode = window.matchMedia?.("(display-mode: standalone)").matches ?? false;
  const iosStandalone =
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return displayMode || iosStandalone;
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ reports as "Macintosh" but is touch-capable.
  const iPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  return /iPad|iPhone|iPod/.test(ua) || iPadOS;
}

export type InstallPlatform =
  | "standalone"
  | "desktop"
  | "ios-safari"
  | "ios-other"
  | "android-chrome"
  | "android-other";

export function getInstallPlatform(): InstallPlatform {
  if (typeof navigator === "undefined") return "desktop";
  if (isStandalone()) return "standalone";
  const ua = navigator.userAgent;
  if (isIOS()) {
    // On iOS only Safari can Add-to-Home-Screen; other browsers must hand off.
    return /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua) ? "ios-other" : "ios-safari";
  }
  if (/Android/.test(ua)) {
    const chromium =
      /Chrome\//.test(ua) && !/EdgA|OPR|SamsungBrowser|Firefox/.test(ua);
    return chromium ? "android-chrome" : "android-other";
  }
  return "desktop";
}

// ---------------------------------------------------------------------------
// Android install prompt capture (beforeinstallprompt)
// ---------------------------------------------------------------------------

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;
let captureInited = false;
const stateListeners = new Set<() => void>();

function notifyInstallState() {
  stateListeners.forEach((cb) => cb());
}

/** Attach the one-time listeners that capture Chrome's install prompt. */
export function initInstallCapture(): void {
  if (captureInited || typeof window === "undefined") return;
  captureInited = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // stash it so we can trigger it from our own UI later
    deferredPrompt = e as BeforeInstallPromptEvent;
    notifyInstallState();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferredPrompt = null;
    notifyInstallState();
  });
}

export function getDeferredPrompt(): BeforeInstallPromptEvent | null {
  return deferredPrompt;
}

export function wasInstalled(): boolean {
  return installed;
}

export function subscribeInstallState(cb: () => void): () => void {
  stateListeners.add(cb);
  return () => {
    stateListeners.delete(cb);
  };
}

export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const evt = deferredPrompt;
  if (!evt) return "unavailable";
  deferredPrompt = null;
  notifyInstallState();
  await evt.prompt();
  const choice = await evt.userChoice;
  return choice.outcome;
}

// ---------------------------------------------------------------------------
// Service worker registration
// ---------------------------------------------------------------------------

export async function registerServiceWorker(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
  } catch {
    /* best-effort — the app is fully usable without push */
  }
}

// ---------------------------------------------------------------------------
// Push subscription
// ---------------------------------------------------------------------------

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  // Back the array with a concrete ArrayBuffer so it satisfies BufferSource.
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

/** Get-or-create the push subscription and persist it for this member. */
async function ensureSubscription(supabase: SupabaseClient, memberId: string): Promise<void> {
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }
  const json = sub.toJSON();
  const endpoint = sub.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!endpoint || !p256dh || !auth) return;
  // endpoint is UNIQUE — upsert keeps this idempotent across repeat logs.
  await supabase
    .from("push_subscriptions")
    .upsert({ member_id: memberId, endpoint, p256dh, auth }, { onConflict: "endpoint" });
}

let promptAttempted = false;

/**
 * Idempotent, gesture-safe push opt-in. Call this from a real user gesture
 * right after a successful log. It no-ops when push is unsupported, already
 * denied, or (on iOS) when the app is not installed to the home screen, and it
 * only shows the native permission dialog once per session while permission is
 * still "default".
 */
export async function maybeSubscribeAfterLog(
  supabase: SupabaseClient,
  memberId: string | null,
): Promise<void> {
  if (!memberId || typeof window === "undefined") return;
  if (
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    return;
  }
  // iOS only exposes Web Push inside an installed (standalone) PWA.
  if (isIOS() && !isStandalone()) return;

  const permission = Notification.permission;
  if (permission === "denied") return;
  if (permission === "granted") {
    try {
      await ensureSubscription(supabase, memberId);
    } catch {
      /* transient — a later log retries */
    }
    return;
  }

  // permission === "default": prompt at most once per session.
  if (promptAttempted) return;
  promptAttempted = true;
  let result: NotificationPermission;
  try {
    result = await Notification.requestPermission();
  } catch {
    promptAttempted = false; // lost user activation — allow a later attempt
    return;
  }
  if (result !== "granted") return;
  try {
    await ensureSubscription(supabase, memberId);
  } catch {
    /* best-effort */
  }
}
