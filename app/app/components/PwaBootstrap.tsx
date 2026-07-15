"use client";

import { useEffect } from "react";
import { initInstallCapture, registerServiceWorker } from "@/app/lib/push";

/**
 * Client-only PWA bootstrap: registers the push service worker and starts
 * capturing Chrome's install prompt as early as possible. Renders nothing.
 * Mounted globally (in the root layout) so the beforeinstallprompt event is
 * never missed regardless of auth state.
 */
export default function PwaBootstrap() {
  useEffect(() => {
    initInstallCapture();
    void registerServiceWorker();
  }, []);
  return null;
}
