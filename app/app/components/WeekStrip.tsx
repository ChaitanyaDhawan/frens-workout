"use client";

import { weekCells } from "@/app/lib/helpers";

interface WeekStripProps {
  doneDoy: Set<number>;
  /** "t-week" on the Home tile, "week" in the You hero. */
  containerClass: "t-week" | "week";
}

/** Trailing 7-day tick strip (shared by the Home tile and the You hero). */
export default function WeekStrip({ doneDoy, containerClass }: WeekStripProps) {
  const cells = weekCells(doneDoy);
  return (
    <div className={containerClass}>
      {cells.map((c) => (
        <div className="twd" key={c.doy}>
          <div className="twl">{c.label}</div>
          <div className={`twc${c.hit ? " hit" : ""}${c.today ? " today" : ""}`}>
            {c.hit ? "✓" : ""}
          </div>
        </div>
      ))}
    </div>
  );
}
