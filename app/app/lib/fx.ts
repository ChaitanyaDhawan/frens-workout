// Tiny registry so any component can fire canvas particle effects without
// threading a ref through the tree. ParticleCanvas registers the concrete
// implementations on mount; callers use the `fx` proxy.

export interface FxApi {
  /** Paper-scrap burst rising from a rect (the hold plate on log). */
  scraps: (rect: DOMRect) => void;
  /** Fiery ember burst rising from a point (the like button). */
  fire: (cx: number, cy: number) => void;
}

let api: FxApi | null = null;

export function registerFx(a: FxApi) {
  api = a;
}

export const fx: FxApi = {
  scraps: (rect) => api?.scraps(rect),
  fire: (cx, cy) => api?.fire(cx, cy),
};
