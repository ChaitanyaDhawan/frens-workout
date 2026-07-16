"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { useStore } from "@/app/lib/store";
import { FeedCard } from "./Feed";

const EASE: [number, number, number, number] = [0.32, 0.72, 0, 1];
const PAGE = 12;

/** Full-page list of my own dispatches — opened from "Show all" in the You tab.
 *  Slides in from the right like a pushed navigation page, over everything. */
export default function DispatchesPage() {
  const { mineFeed, closeDispatches } = useStore();
  const [limit, setLimit] = useState(PAGE);
  const shown = mineFeed.slice(0, limit);
  const remaining = mineFeed.length - limit;

  return (
    <motion.div
      className="disp-page"
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ duration: 0.32, ease: EASE }}
    >
      <div className="disp-head">
        <button className="disp-back" onClick={closeDispatches} aria-label="Back">
          ‹
        </button>
        <h2>My dispatches</h2>
        <span className="disp-count">{mineFeed.length}</span>
      </div>
      <div className="disp-body">
        {mineFeed.length === 0 ? (
          <div className="mine-empty">No dispatches yet — log a workout to start your ledger.</div>
        ) : (
          <>
            {shown.map((f) => (
              <FeedCard key={f.id} item={f} mountDelay={null} />
            ))}
            {remaining > 0 && (
              <button className="mine-more" onClick={() => setLimit((l) => l + PAGE)}>
                View {Math.min(remaining, PAGE)} more · {remaining} left
              </button>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
