"use client";

import type { Member } from "@/app/lib/data";

/** All-time activity split as percentage bars, computed over IN-APP workouts
 *  only. Imported pre-app history (check-marks with no type) is shown apart in a
 *  grayed row and left out of the percentages. Untyped in-app entries show as
 *  "Workout". Shared by the profile and the You tab so they stay identical. */
export default function ActivityBreakdown({ member, title = "Activities" }: { member: Member; title?: string }) {
  const total = member.allTime ?? 0;
  const preApp = member.preApp ?? 0;
  const appTotal = Math.max(0, total - preApp); // in-app workouts drive the mix
  const rows: [string, number][] = [
    ...Object.entries(member.typeCounts ?? {}),
    ...(member.untagged ? ([["Workout", member.untagged]] as [string, number][]) : []),
  ].sort((a, b) => b[1] - a[1]);

  const preAppRow =
    preApp > 0 ? (
      <div className="act-row preapp" key="__preapp">
        <span className="act-name">Before FRENS</span>
        <span className="act-note">pre-app · not in the mix</span>
        <span className="act-val">
          <b>{preApp}</b>
        </span>
      </div>
    ) : null;

  if (!appTotal) {
    return (
      <>
        <div className="prof-sec">{title}</div>
        {preApp > 0 ? (
          <>
            <div className="prof-empty2">No in-app workouts yet — log one to start your mix.</div>
            <div className="act-list">{preAppRow}</div>
          </>
        ) : (
          <div className="prof-empty2">No workouts logged yet.</div>
        )}
      </>
    );
  }

  return (
    <>
      <div className="prof-sec">
        {title} <span className="sec-total">· {appTotal} in app</span>
      </div>
      <div className="act-list">
        {rows.map(([name, c]) => {
          const pct = Math.round((c / appTotal) * 100);
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
        {preAppRow}
      </div>
    </>
  );
}
