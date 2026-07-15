"use client";

import { TODAY_DOY } from "@/app/lib/data";

/** Compact 30-day activity strip — filled bars are days worked out. Labeled so
 *  it's clear what it is; the count lives in the "Last 30 days" stat above. */
export default function HistoryStrip({ doneDoy }: { doneDoy: Set<number> }) {
  const start = Math.max(1, TODAY_DOY - 29);
  const days: number[] = [];
  for (let d = start; d <= TODAY_DOY; d++) days.push(d);

  return (
    <div>
      <div className="hist">
        {days.map((d) => (
          <div
            key={d}
            className={`hist-cell${doneDoy.has(d) ? " hit" : ""}${d === TODAY_DOY ? " today" : ""}`}
          />
        ))}
      </div>
      <div className="hist-cap">Last 30 days</div>
    </div>
  );
}
