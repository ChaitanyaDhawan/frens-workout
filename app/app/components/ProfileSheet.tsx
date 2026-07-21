"use client";

import { useRef } from "react";
import { motion } from "motion/react";
import { useStore } from "@/app/lib/store";
import { initials, val } from "@/app/lib/helpers";
import { CURRENT_Q } from "@/app/lib/data";
import HistoryStrip from "./HistoryStrip";
import ActivityBreakdown from "./ActivityBreakdown";
import Rankings from "./Rankings";

const SHEET_EASE: [number, number, number, number] = [0.3, 1.15, 0.35, 1];

/** A member's profile — totals, best streak, kudos, activity split, a 30-day
 *  strip, and per-period rankings. Opens from any name/avatar. */
export default function ProfileSheet() {
  const { profileMember, frens, closeProfile } = useStore();
  const snap = useRef(profileMember);
  if (profileMember) snap.current = profileMember;
  const m = snap.current ? frens.find((f) => f.name === snap.current) : undefined;

  const shell = (children: React.ReactNode) => (
    <motion.div
      className="sheet prof-sheet"
      style={{ x: "-50%" }}
      initial={{ y: "105%" }}
      animate={{ y: 0 }}
      exit={{ y: "105%" }}
      transition={{ duration: 0.4, ease: SHEET_EASE }}
    >
      <div className="shead prof-head">
        <button className="al-x" onClick={closeProfile} aria-label="Close">
          ✕
        </button>
      </div>
      {children}
    </motion.div>
  );

  if (!m) return shell(<div className="prof-empty">No profile yet.</div>);

  const allTime = m.allTime ?? 0;
  // m.streak is computed against the MEMBER's own timezone in the aggregate —
  // never re-derive it here with the viewer's today.
  const streak = m.streak;
  const stats: { v: string; k: string; fire?: boolean }[] = [
    { v: String(val(m, CURRENT_Q)), k: `This ${CURRENT_Q.toUpperCase()}` },
    { v: String(allTime), k: "All-time" },
    { v: String(m.bestStreak ?? 0), k: "Best streak" },
    { v: String(m.kudosAll ?? 0), k: "Kudos", fire: true },
  ];

  return shell(
    <>
      <div className="prof-hero">
        <div className="prof-ava">{initials(m.name)}</div>
        <div className="prof-name">
          {m.name}
          {m.you && <span className="youtag">YOU</span>}
          {streak >= 2 && (
            <span className="prof-streak" aria-label={`${streak} day streak`}>
              {streak}
              <span className="pf">🔥</span>
            </span>
          )}
        </div>
        <div className="prof-tag">
          {allTime} workout{allTime === 1 ? "" : "s"} on the record · est. 2025
        </div>
      </div>

      <div className="prof-stats">
        {stats.map((s) => (
          <div className="prof-stat" key={s.k}>
            <div className="v">
              {s.v}
              {s.fire && <span className="stat-ico"> 👏</span>}
            </div>
            <div className="k">{s.k}</div>
          </div>
        ))}
      </div>

      <ActivityBreakdown member={m} />

      <div className="prof-sec">Last 30 days</div>
      <HistoryStrip doneDoy={m.days ?? new Set<number>()} end={m.today} />

      <Rankings member={m} frens={frens} />
    </>,
  );
}
