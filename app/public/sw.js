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
  const targetUrl = new URL(data.url || "/", self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Prefer an already-open FRENS window on the exact target.
        for (const client of clientList) {
          if (client.url === targetUrl && "focus" in client) return client.focus();
        }
        // Otherwise reuse any open window: focus it and navigate.
        for (const client of clientList) {
          if ("focus" in client) {
            if ("navigate" in client) {
              return client.focus().then(() => client.navigate(targetUrl));
            }
            return client.focus();
          }
        }
        // Nothing open — open a fresh window.
        if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
        return undefined;
      }),
  );
});
