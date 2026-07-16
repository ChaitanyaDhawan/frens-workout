"use client";

import { useRef, useState } from "react";
import { motion } from "motion/react";
import { useStore } from "@/app/lib/store";
import { initials, pad, rankOf, val } from "@/app/lib/helpers";
import { PERIODS, CURRENT_Q, type PeriodId } from "@/app/lib/data";
import HistoryStrip from "./HistoryStrip";

const SHEET_EASE: [number, number, number, number] = [0.3, 1.15, 0.35, 1];
const Q_IDS: PeriodId[] = ["q1", "q2", "q3", "q4"];

/** A member's profile — totals, best streak, kudos, an activity breakdown, a
 *  30-day strip, and per-period rankings. Opens from any name/avatar. */
export default function ProfileSheet() {
  const { profileMember, frens, closeProfile } = useStore();
  const [allRanks, setAllRanks] = useState(false);
  // Keep the last member through the exit animation.
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

  // Activity breakdown (all-time), untagged included, most-done first.
  const acts: [string, number][] = [
    ...Object.entries(m.typeCounts ?? {}),
    ...(m.untagged ? ([["Untagged", m.untagged]] as [string, number][]) : []),
  ].sort((a, b) => b[1] - a[1]);
  const maxAct = Math.max(1, ...acts.map(([, c]) => c));

  // Rankings — quarters newest-first, then 2026 / 2025 / All-time. Show 3, expand for the rest.
  const quarters = PERIODS.filter((p) => Q_IDS.includes(p.id)).slice().reverse();
  const aggregates = PERIODS.filter((p) => !Q_IDS.includes(p.id));
  const ranks = [...quarters, ...aggregates];
  const shownRanks = allRanks ? ranks : ranks.slice(0, 3);

  const stats: { v: string; k: string }[] = [
    { v: String(val(m, CURRENT_Q)), k: `This ${CURRENT_Q.toUpperCase()}` },
    { v: String(allTime), k: "All-time" },
    { v: String(m.bestStreak ?? 0), k: "Best streak" },
    { v: String(m.kudosAll ?? 0), k: "Kudos" },
  ];

  return shell(
    <>
      <div className="prof-hero">
        <div className="prof-ava">{initials(m.name)}</div>
        <div className="prof-name">
          {m.name}
          {m.you && <span className="youtag">YOU</span>}
        </div>
        <div className="prof-tag">
          {allTime} workout{allTime === 1 ? "" : "s"} on the record · est. 2025
        </div>
      </div>

      <div className="prof-stats">
        {stats.map((s) => (
          <div className="prof-stat" key={s.k}>
            <div className="v">{s.v}</div>
            <div className="k">{s.k}</div>
          </div>
        ))}
      </div>

      <div className="prof-sec">Activities · all-time</div>
      {acts.length ? (
        <div className="prof-actlist">
          {acts.map(([t, c]) => (
            <div className={`prof-actrow${t === "Untagged" ? " untag" : ""}`} key={t}>
              <span className="pa-name">{t}</span>
              <span className="pa-bar">
                <span className="pa-fill" style={{ width: `${(c / maxAct) * 100}%` }} />
              </span>
              <span className="pa-c">{c}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="prof-empty2">No workouts logged yet.</div>
      )}

      <div className="prof-sec">Last 30 days</div>
      <HistoryStrip doneDoy={m.days ?? new Set<number>()} />

      <div className="prof-sec">Rankings</div>
      <div className="prof-ranks">
        {shownRanks.map((p) => {
          const v = val(m, p.id);
          const r = rankOf(frens, m.name, p.id);
          return (
            <div className="prof-rank" key={p.id}>
              <span className="pl">
                {p.lbl}
                {p.live && <span className="plive"> live</span>}
              </span>
              <span className="pr">{v > 0 ? `#${pad(r)}` : "—"}</span>
              <span className="pc">
                {v} <span className="pcu">days</span>
              </span>
            </div>
          );
        })}
      </div>
      {ranks.length > 3 && (
        <button className="prof-more" onClick={() => setAllRanks((v) => !v)}>
          {allRanks ? "Show less" : `Show all ${ranks.length}`}
        </button>
      )}
    </>,
  );
}
