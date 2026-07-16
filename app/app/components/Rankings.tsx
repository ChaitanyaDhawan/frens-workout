"use client";

import { useState } from "react";
import { PERIODS, type Member, type PeriodId } from "@/app/lib/data";
import { pad, rankOf, val } from "@/app/lib/helpers";

const Q_IDS: PeriodId[] = ["q1", "q2", "q3", "q4"];

/** Per-period standings, newest-first (current quarter → back), 3 then "show
 *  all". Shared by the profile and the You tab. */
export default function Rankings({ member, frens }: { member: Member; frens: Member[] }) {
  const [all, setAll] = useState(false);
  const quarters = PERIODS.filter((p) => Q_IDS.includes(p.id)).slice().reverse();
  const aggregates = PERIODS.filter((p) => !Q_IDS.includes(p.id));
  const ranks = [...quarters, ...aggregates];
  const shown = all ? ranks : ranks.slice(0, 3);

  return (
    <>
      <div className="prof-sec">Rankings</div>
      <div className="prof-ranks">
        {shown.map((p) => {
          const v = val(member, p.id);
          const r = rankOf(frens, member.name, p.id);
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
        <button className="prof-more" onClick={() => setAll((v) => !v)}>
          {all ? "Show less" : `Show all · ${ranks.length}`}
        </button>
      )}
    </>
  );
}
