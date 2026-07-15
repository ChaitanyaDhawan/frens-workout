"use client";

import { useEffect } from "react";
import { motion } from "motion/react";
import { useStore } from "@/app/lib/store";
import { fx } from "@/app/lib/fx";
import { fmtDate } from "@/app/lib/helpers";
import { makeShareCard } from "@/app/lib/shareCard";

const CEL_EASE: [number, number, number, number] = [0.2, 1.1, 0.3, 1];

/** Full-screen celebration shown after a workout is logged. */
export default function Celebration() {
  const { celebration, me, closeCelebration, editCelebration } = useStore();

  useEffect(() => {
    if (!celebration) return;
    navigator.vibrate?.([12, 40, 18, 40, 24]);
    const t = setTimeout(() => {
      const w = window.innerWidth;
      const y = window.innerHeight * 0.32;
      // a wide burst across the upper third
      fx.scraps({ left: w * 0.15, top: y, width: w * 0.7, right: w * 0.85, bottom: y + 10, height: 10, x: w / 2, y } as DOMRect);
    }, 160);
    return () => clearTimeout(t);
  }, [celebration]);

  if (!celebration) return null;
  const c = celebration;

  const onShare = () =>
    makeShareCard({
      name: me.name,
      headline: c.headline,
      activity: c.activity,
      dateLabel: fmtDate(c.doy),
      stats: c.stats,
      photoUrl: c.photoUrl,
    });

  return (
    <div className="cel-scrim" role="dialog" aria-modal="true">
      <motion.div
        className="cel"
        initial={{ y: 26, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: CEL_EASE }}
      >
        <div className="cel-eyebrow">On the record</div>
        <motion.div
          className="cel-badge"
          initial={{ scale: 0, rotate: -25 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.12, duration: 0.5, ease: [0.2, 1.8, 0.4, 1] }}
        >
          ✓
        </motion.div>
        <h1 className="cel-headline">{c.headline}</h1>
        <div className="cel-sub">{c.sub}</div>
        <div className="cel-act">{c.activity}</div>

        {c.photoUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img className="cel-photo" src={c.photoUrl} alt="Your proof" />
        )}

        <div className="cel-stats">
          {c.stats.map((s) => (
            <div className="cel-stat" key={s.label}>
              <div className="cel-stat-v">{s.value}</div>
              <div className="cel-stat-k">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="cel-btns">
          <button className="cel-share" onClick={onShare}>
            ⤴ Share card
          </button>
          <button className="cel-edit" onClick={editCelebration}>
            Edit
          </button>
        </div>
        <button className="cel-done" onClick={closeCelebration}>
          Done
        </button>
      </motion.div>
    </div>
  );
}
