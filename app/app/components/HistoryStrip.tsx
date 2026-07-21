"use client";

import { TODAY_DOY } from "@/app/lib/data";

/** Compact 30-day activity strip — filled bars are days worked out. Labeled so
 *  it's clear what it is; the count lives in the "Last 30 days" stat above.
 *  `end` = "today" in the frame the days were computed in — pass the member's
 *  own today (Member.today) when rendering ANOTHER member's strip, so their
 *  freshest workout doesn't fall off the edge across timezones. */
export default function HistoryStrip({ doneDoy, end = TODAY_DOY }: { doneDoy: Set<number>; end?: number }) {
  const start = Math.max(1, end - 29);
  const days: number[] = [];
  for (let d = start; d <= end; d++) days.push(d);

  return (
    <div>
      <div className="hist">
        {days.map((d) => (
          <div
            key={d}
            className={`hist-cell${doneDoy.has(d) ? " hit" : ""}${d === end ? " today" : ""}`}
          />
        ))}
      </div>
      <div className="hist-cap">Last 30 days</div>
    </div>
  );
}
