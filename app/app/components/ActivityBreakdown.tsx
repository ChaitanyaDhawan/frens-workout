"use client";

import type { Member } from "@/app/lib/data";

/** All-time activity split as percentage bars. Untyped workouts show as
 *  "Workout" (the app's label for an untagged entry). Shared by the profile
 *  and the You tab so they stay identical. */
export default function ActivityBreakdown({ member, title = "Activities" }: { member: Member; title?: string }) {
  const total = member.allTime ?? 0;
  const rows: [string, number][] = [
    ...Object.entries(member.typeCounts ?? {}),
    ...(member.untagged ? ([["Workout", member.untagged]] as [string, number][]) : []),
  ].sort((a, b) => b[1] - a[1]);

  if (!total || !rows.length) {
    return (
      <>
        <div className="prof-sec">{title}</div>
        <div className="prof-empty2">No workouts logged yet.</div>
      </>
    );
  }

  return (
    <>
      <div className="prof-sec">
        {title} <span className="sec-total">· {total} total</span>
      </div>
      <div className="act-list">
        {rows.map(([name, c]) => {
          const pct = Math.round((c / total) * 100);
          return (
            <div className="act-row" key={name}>
              <span className="act-name">{name}</span>
              <span className="act-bar">
                <span className="act-fill" style={{ width: `${Math.max(3, pct)}%` }} />
              </span>
              <span className="act-val">
                <b>{c}</b>
                <span className="act-p">{pct}%</span>
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}
