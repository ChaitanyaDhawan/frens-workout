"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "motion/react";

/** How long the title card holds before fading up to reveal the app. */
const SPLASH_MS = 900;
/** Shorter hold when the OS asks for reduced motion (plain fade, no choreography). */
const SPLASH_REDUCED_MS = 800;

/** Decelerating "settle" ease shared by the crest, wordmark, and rules. */
const SETTLE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/**
 * Cold-start title card — the crest lands with a soft settle, a gold shine
 * sweeps across it (alpha-masked to the shield), the wordmark rises out of a
 * baseline mask, hairline rules draw outward, then the whole card fades up to
 * reveal the app.
 *
 * Dismissal is purely time-based (plus tap-to-skip), so it never waits on
 * auth/data and can't strand the user behind an overlay. A CSS failsafe on
 * `.splash` in globals.css hides it even if hydration never happens.
 *
 * Reduced motion is handled by MotionConfig (transforms snap, fades remain)
 * rather than conditional rendering, so SSR and client markup always match.
 */
export default function Splash() {
  const reduced = useReducedMotion();
  const [show, setShow] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setShow(false), reduced ? SPLASH_REDUCED_MS : SPLASH_MS);
    return () => clearTimeout(t);
  }, [reduced]);

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {show && (
          <motion.div
            className="splash"
            exit={{ opacity: 0, scale: 1.04 }}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            onPointerDown={() => setShow(false)}
          >
            {/* Contents wink out ahead of the paper veil so the crossfade never
                double-exposes splash type over app type. */}
            <motion.div
              className="splash-inner"
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
            >
              <motion.div
                className="splash-crest"
                initial={{ opacity: 0, scale: 0.84, y: 14, filter: "blur(6px)" }}
                animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
                transition={{ delay: 0.05, duration: 0.45, ease: SETTLE }}
              >
                <img src="/icons/icon-splash.png" alt="" fetchPriority="high" draggable={false} />
                <div className="splash-shine" aria-hidden>
                  <motion.div
                    className="splash-shine-band"
                    initial={{ x: "-130%" }}
                    animate={{ x: "330%" }}
                    transition={{ delay: 0.45, duration: 0.5, ease: [0.45, 0, 0.3, 1] }}
                  />
                </div>
              </motion.div>

              {/* overflow-hidden mask; the line of type rises out of it */}
              <div className="splash-word">
                <motion.div
                  initial={{ y: "112%" }}
                  animate={{ y: "0%" }}
                  transition={{ delay: 0.25, duration: 0.4, ease: SETTLE }}
                >
                  <i>FRENS</i> WORKOUT
                </motion.div>
              </div>

              <div className="splash-eyebrow">
                <motion.span
                  className="splash-rule"
                  style={{ originX: 1 }}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.42, duration: 0.35, ease: SETTLE }}
                />
                <motion.span
                  initial={{ opacity: 0, letterSpacing: "0.12em" }}
                  animate={{ opacity: 1, letterSpacing: "0.28em" }}
                  transition={{ delay: 0.4, duration: 0.35, ease: "easeOut" }}
                >
                  Est. 2025 · 13 athletes
                </motion.span>
                <motion.span
                  className="splash-rule"
                  style={{ originX: 0 }}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.42, duration: 0.35, ease: SETTLE }}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
