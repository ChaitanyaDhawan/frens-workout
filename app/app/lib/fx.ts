// Tiny registry so any component can fire canvas particle effects without
// threading a ref through the tree. ParticleCanvas registers the concrete
// implementations on mount; callers use the `fx` proxy.

export interface FxApi {
  /** Paper-scrap burst rising from a rect (the hold plate on log). */
  scraps: (rect: DOMRect) => void;
  /** Handclap burst popping from a point (giving or collecting kudos). */
  clap: (cx: number, cy: number) => void;
  /** iMessage-style full-screen stream of one emoji floating up (tapbacks,
   *  kudos applause). Optional durMs spreads the stream over that window —
   *  pass the applause length to sync the visuals to the sound. */
  emojiRain: (emoji: string, durMs?: number) => void;
}

let api: FxApi | null = null;

export function registerFx(a: FxApi) {
  api = a;
}

export const fx: FxApi = {
  scraps: (rect) => api?.scraps(rect),
  clap: (cx, cy) => api?.clap(cx, cy),
  emojiRain: (emoji, durMs) => api?.emojiRain(emoji, durMs),
};
