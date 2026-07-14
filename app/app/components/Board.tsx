"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { useStore } from "@/app/lib/store";
import { PERIODS, TODAY_D, type Member, type PeriodId } from "@/app/lib/data";
import { initials, lastOf, pad, val } from "@/app/lib/helpers";
import FlapCounter from "./FlapCounter";

interface RankedRow {
  f: Member;
  v: number;
  rank: number;
}

function rankedRows(frens: Member[], period: PeriodId): RankedRow[] {
  const sorted = [...frens].sort((a, b) => val(b, period) - val(a, period) || a.name.localeCompare(b.name));
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
}: {
  row: RankedRow;
  period: PeriodId;
  doneCount: number;
  flapKey: number;
  reorderKey: number;
  rowinDelay: number;
}) {
  const { f, v, rank } = row;
  const isR1 = rank === 1 && v > 0;
  const last = f.you && doneCount ? "Jul " + TODAY_D : lastOf(f, period);
  const style = { animation: `rowin .32s ${rowinDelay}ms both` } as React.CSSProperties;

  return (
    <motion.div
      layout
      layoutDependency={reorderKey}
      className={`row${isR1 ? " r1" : ""}`}
      style={style}
      data-n={f.name}
    >
      <div className="rank">{pad(rank)}</div>
      <div className="ava">{initials(f.name)}</div>
      <div className="who">
        <div className="nm">
          {f.name}
          {f.you && <span className="youtag">YOU</span>}
        </div>
        <div className="sub">
          {f.streak > 0 && period === "q3" ? (
            <span className="st">▲ {f.streak}-day streak</span>
          ) : last ? (
            `Last · ${last}`
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
  const { frens, period, doneDoy, setPeriod, flapTick, reorderTick } = useStore();
  const p = PERIODS.find((x) => x.id === period)!;
  const rows = rankedRows(frens, period);
  const meds = rows.slice(0, 3).map((r) => r.f);
  const doneCount = doneDoy.size;

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

      {p.final ? (
        <div className="final-line">
          <span className="fin">Final.</span> <b>{rows[0].f.name}</b> took {p.lbl} with <b>{rows[0].v}</b> entries
        </div>
      ) : period === "q3" ? (
        <div className="prog">
          <div className="rule">
            <div className="fill" />
            <div className="cap" />
          </div>
          <div className="lbl">
            <span>Q3 · Day 15 of 92</span>
            <span>77 days remain</span>
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
          />
        ))}
      </div>
    </>
  );
}
