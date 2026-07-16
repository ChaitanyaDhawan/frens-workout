"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "motion/react";
import { isAppReady, onAppReady } from "@/app/lib/ready";

/** Minimum hold so the intro choreography always plays. */
const SPLASH_MIN_MS = 900;
/** Shorter minimum when the OS asks for reduced motion (plain fade). */
const SPLASH_MIN_REDUCED_MS = 800;
/** JS failsafe — dismiss even if "ready" never fires. Under the 7s CSS backstop. */
const SPLASH_MAX_MS = 6500;

/** Decelerating "settle" ease shared by the crest, wordmark, and rules. */
const SETTLE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/**
 * Cold-start title card — the crest lands with a soft settle, a gold shine
 * sweeps across it (alpha-masked to the shield), the wordmark rises out of a
 * baseline mask, hairline rules draw outward, then the whole card fades up to
 * reveal the app.
 *
 * Dismissal holds until the app has real content to show (auth resolved + data
 * loaded, signalled via onAppReady) so there's no fade to a separate "Loading…"
 * screen — the splash IS the loading screen, with a looping shimmer while it
 * waits. A minimum hold lets the intro play; a JS + CSS failsafe (both ~7s)
 * guarantee it never strands the user behind the overlay. Tap-to-skip too.
 *
 * Reduced motion is handled by MotionConfig (transforms snap, fades remain)
 * rather than conditional rendering, so SSR and client markup always match.
 */
export default function Splash() {
  const reduced = useReducedMotion();
  const [show, setShow] = useState(true);
  const [minDone, setMinDone] = useState(false);
  const [ready, setReady] = useState(() => isAppReady());

  useEffect(() => {
    const min = reduced ? SPLASH_MIN_REDUCED_MS : SPLASH_MIN_MS;
    const tMin = setTimeout(() => setMinDone(true), min);
    const tMax = setTimeout(() => setShow(false), SPLASH_MAX_MS);
    const unsub = onAppReady(() => setReady(true));
    return () => {
      clearTimeout(tMin);
      clearTimeout(tMax);
      unsub();
    };
  }, [reduced]);

  // Reveal the app once the intro has had its minimum, AND real content is ready.
  useEffect(() => {
    if (minDone && ready) setShow(false);
  }, [minDone, ready]);

  // Held past the intro but still loading → keep a subtle shimmer looping.
  const waiting = minDone && !ready;

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
                  {/* Still loading past the intro — a shimmer keeps sweeping so
                      the card feels alive instead of frozen. */}
                  {waiting && (
                    <motion.div
                      className="splash-shine-band"
                      initial={{ x: "-130%" }}
                      animate={{ x: "330%" }}
                      transition={{ duration: 1.15, ease: "easeInOut", repeat: Infinity, repeatDelay: 0.35 }}
                    />
                  )}
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
