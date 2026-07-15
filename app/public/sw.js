/*
 * FRENS — push-only service worker.
 *
 * Deliberately has NO `fetch` handler and does NO precaching: it must never
 * intercept navigation requests, so shipping a new build can never strand a
 * user on a stale cached page. Its only jobs are showing push notifications
 * and routing a tap back into the app.
 */

self.addEventListener("install", () => {
  // Activate this worker immediately instead of waiting for old tabs to close.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }
  const title = payload.title || "FRENS";
  const body = payload.body || "";
  const url = payload.url || "/";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const url = data.url || "/";
  const targetUrl = new URL(url, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Reuse any open FRENS window: focus it and deliver the deep-link by
      // message (reliable even where client.navigate isn't, e.g. installed PWAs).
      for (const client of clientList) {
        if ("focus" in client) {
          await client.focus();
          try {
            client.postMessage({ type: "FRENS_DEEPLINK", url: url });
          } catch (e) {
            /* ignore */
          }
          return;
        }
      }
      // Nothing open — open a fresh window at the target; the app reads ?w= on load.
      if (self.clients.openWindow) await self.clients.openWindow(targetUrl);
    })(),
  );
});
