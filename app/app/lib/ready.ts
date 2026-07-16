// Tiny module-level "the app has real content to show" signal, so the cold-open
// splash can stay up until then (instead of fading to a separate "Loading…"
// screen). Fired once — by the store after its first data load, or by the auth
// gate when it lands on sign-in / claim / demo. Idempotent.

let ready = false;
const subs = new Set<() => void>();

export function markAppReady(): void {
  if (ready) return;
  ready = true;
  subs.forEach((f) => f());
  subs.clear();
}

export function isAppReady(): boolean {
  return ready;
}

/** Run cb when the app is ready (immediately if already). Returns an unsubscribe. */
export function onAppReady(cb: () => void): () => void {
  if (ready) {
    cb();
    return () => {};
  }
  subs.add(cb);
  return () => subs.delete(cb);
}
