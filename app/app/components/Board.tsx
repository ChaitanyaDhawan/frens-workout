"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { useStore } from "@/app/lib/store";
import { CURRENT_Q, PERIODS, Q_BOUNDS, TODAY_D, TODAY_M, TODAY_DOY, type Member, type PeriodId } from "@/app/lib/data";

const MON_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
import { initials, lastOf, pad, val } from "@/app/lib/helpers";
import FlapCounter from "./FlapCounter";
import Flame from "./Flame";

/** The coolest one-liner to put under a name on the live board. Returns null to
 *  fall back to "Last · <date>" / "No entries yet". */
function coolFact(f: Member): { text: string; flame: boolean } | null {
  if (f.lastDoy == null) return null;
  const streak = f.streak ?? 0;
  const last7 = f.last7 ?? 0;
  const last30 = f.last30 ?? 0;
  if (streak >= 2) return { text: `${streak}-day streak`, flame: true };
  if (f.lastDoy === TODAY_DOY) return { text: last7 >= 3 ? `${last7} days this week` : "On the board today", flame: true };
  if (f.lastDoy === TODAY_DOY - 1) return { text: last7 >= 2 ? `${last7} days this week` : "Back at it yesterday", flame: last7 >= 2 };
  if (last30 >= 10) return { text: `${last30} in the last 30`, flame: false };
  if (last7 >= 1) return { text: `${last7} this week`, flame: false };
  if (last30 >= 1) return { text: `${last30} in the last 30`, flame: false };
  return null;
}

interface RankedRow {
  f: Member;
  v: number;
  rank: number;
}

function rankedRows(frens: Member[], period: PeriodId): RankedRow[] {
  const sorted = [...frens].sort((a, b) => val(b, period) - val(a, period) || a.name.localeCompare(b.name));
  // Competition ranking (1,2,2,4…) — genuine ties share a rank (joint 6th, etc.).
  let rank = 0;
  let prev: number | null = null;
  let shown = 0;
  return sorted.map((f) => {
    shown++;
    const v = val(f, period);
    if (v !== prev) {
      rank = shown;
      prev = v;
    }
    return { f, v, rank };
  });
}

function PeriodPicker({ period, onPick }: { period: PeriodId; onPick: (p: PeriodId) => void }) {
  return (
    <div className="periods">
      {PERIODS.map((p) => (
        <button
          key={p.id}
          className={`period${p.id === period ? " sel" : ""}`}
          data-p={p.id}
          onClick={() => onPick(p.id)}
        >
          {p.live && <span className="dot" />}
          {p.lbl}
          {p.final ? " · F" : ""}
        </button>
      ))}
    </div>
  );
}

function Podium({ meds, period }: { meds: Member[]; period: PeriodId }) {
  return (
    <div className="podium">
      {[1, 0, 2].map((idx, pos) => {
        const f = meds[idx];
        if (!f) return null;
        // Fixed positional delay — stable string, so it plays once per mount.
        const style = {
          animation: `plqin .4s ${pos * 80}ms both cubic-bezier(.2,1.2,.4,1)`,
        } as React.CSSProperties;
        return (
          <div key={idx} className={`plq p${idx + 1}`} style={style}>
            <div className="medal">
              <span className="mc">{val(f, period)}</span>
            </div>
            <div className="mdays">days</div>
            <div className="riser">
              <span className="rno">{idx + 1}</span>
              <span className="rn-name">{f.name}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BoardRow({
  row,
  period,
  doneCount,
  flapKey,
  reorderKey,
  rowinDelay,
  onProfile,
}: {
  row: RankedRow;
  period: PeriodId;
  doneCount: number;
  flapKey: number;
  reorderKey: number;
  rowinDelay: number;
  onProfile: (name: string) => void;
}) {
  const { f, v, rank } = row;
  const isR1 = rank === 1 && v > 0;
  // A just-logged "today" only belongs to periods that contain today — not past
  // quarters or the 2025 board, where it would mislabel the signed-in user's row.
  const includesToday = period === CURRENT_Q || period === "yr" || period === "all";
  const last = f.you && doneCount && includesToday ? `${MON_ABBR[TODAY_M]} ${TODAY_D}` : lastOf(f, period);
  const fact = period === CURRENT_Q ? coolFact(f) : null;

  return (
    <motion.div
      layout
      layoutDependency={reorderKey}
      className={`row${isR1 ? " r1" : ""}`}
      data-n={f.name}
      onClick={() => onProfile(f.name)}
      style={{ cursor: "pointer" }}
      // Each scoreboard row slides + fades in as it scrolls into view (once),
      // instead of all animating at mount off-screen. Composes with `layout`
      // since the reveal completes before any reorder.
      initial={{ opacity: 0, x: -10 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1], delay: rowinDelay / 1000 }}
    >
      <div className="rank">{pad(rank)}</div>
      <div className="ava">{initials(f.name)}</div>
      <div className="who">
        <div className="nm">
          {f.name}
          {f.you && <span className="youtag">YOU</span>}
        </div>
        <div className="sub">
          {fact ? (
            <span className="st">
              {fact.flame && <Flame lit bounceTick={0} className="flame rowflame" />}
              {fact.flame ? " " : ""}
              {fact.text}
            </span>
          ) : last ? (
            `Last · ${last}`
          ) : v > 0 ? (
            ""
          ) : (
            "No entries yet"
          )}
        </div>
      </div>
      <FlapCounter className="flaps" value={v} flipKey={flapKey} />
    </motion.div>
  );
}

export default function Board() {
  const { frens, period, doneDoy, setPeriod, flapTick, reorderTick, openProfile } = useStore();
  const p = PERIODS.find((x) => x.id === period)!;
  const rows = rankedRows(frens, period);
  const meds = rows.slice(0, 3).map((r) => r.f);
  const doneCount = doneDoy.size;
  // Live progress for whichever quarter is currently running.
  const [qStart, qEnd] = Q_BOUNDS[CURRENT_Q];
  const qLen = qEnd - qStart + 1;
  const qDay = Math.max(0, TODAY_DOY - (qStart - 1));
  const qPct = Math.max(0, Math.min(100, (qDay / qLen) * 100));
  const qDaysLeft = Math.max(0, qEnd - TODAY_DOY);

  // Fixed per-athlete entrance delays captured at mount (by initial rank order),
  // so a row keeps its delay through reorders and never replays `rowin`.
  const [rowDelays] = useState(() => {
    const map = new Map<string, number>();
    rankedRows(frens, period).forEach((r, i) => map.set(r.f.name, Math.min(i * 35, 420)));
    return map;
  });

  return (
    <>
      <PeriodPicker period={period} onPick={setPeriod} />

      {p.final && rows[0] ? (
        <div className="final-line">
          <span className="fin">Final.</span> <b>{rows[0].f.name}</b> took {p.lbl} with <b>{rows[0].v}</b> entries
        </div>
      ) : period === CURRENT_Q ? (
        <div className="prog">
          <div className="rule">
            <div className="fill" style={{ width: `${qPct}%` }} />
            <div className="cap" style={{ left: `${qPct}%` }} />
          </div>
          <div className="lbl">
            <span>{CURRENT_Q.toUpperCase()} · Day {qDay} of {qLen}</span>
            <span>{qDaysLeft} days remain</span>
          </div>
        </div>
      ) : null}

      <div className="podium-wrap">
        <div className="podium-cap">
          <span className="pc-l">The Podium</span>
          <span className="pc-r">{p.lbl} · workout days</span>
        </div>
        <Podium meds={meds} period={period} />
      </div>

      <div className="list">
        {rows.map((r) => (
          <BoardRow
            key={r.f.name}
            row={r}
            period={period}
            doneCount={doneCount}
            flapKey={flapTick}
            reorderKey={reorderTick}
            rowinDelay={rowDelays.get(r.f.name) ?? 0}
            onProfile={openProfile}
          />
        ))}
      </div>
    </>
  );
}
