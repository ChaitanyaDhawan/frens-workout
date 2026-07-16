"use client";

import { useStore } from "@/app/lib/store";
import { pad, rankOf, streakNow, val } from "@/app/lib/helpers";
import { CURRENT_Q, TODAY_DOY } from "@/app/lib/data";
import FlapCounter from "./FlapCounter";
import HistoryStrip from "./HistoryStrip";

const QL = CURRENT_Q.toUpperCase();

/** Home tile — this-quarter entries (solari), last-30 count, rank, 30-day strip. Taps to You. */
export default function StatsTile() {
  const { me, frens, doneDoy, rollTick, setTab } = useStore();
  const rank = rankOf(frens, me.name, CURRENT_Q);
  const streak = streakNow(doneDoy);
  let last30 = 0;
  for (let d = Math.max(1, TODAY_DOY - 29); d <= TODAY_DOY; d++) if (doneDoy.has(d)) last30++;

  return (
    <div
      className="tile-you"
      role="button"
      tabIndex={0}
      onClick={() => setTab("you")}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setTab("you");
        }
      }}
    >
      {streak > 0 && (
        <div className="streak-sticker" aria-label={`${streak} day streak`}>
          <span className="ss-num">{streak}</span>
          <span className="ss-flame">🔥</span>
        </div>
      )}
      <div className="t-top">
        <span className="t-eyebrow">Your {QL}</span>
        <span className="t-link">Your ledger →</span>
      </div>
      <div className="t-body">
        <div>
          <FlapCounter className="t-flaps" value={val(me, CURRENT_Q)} rollKey={rollTick} />
          <div className="t-cap">Entries</div>
        </div>
        <div className="t-div" />
        <div className="t-stat">
          <div className="v">{last30}</div>
          <div className="k">Last 30 days</div>
        </div>
        <div className="t-div" />
        <div className="t-stat">
          <div className="v">{"#" + pad(rank)}</div>
          <div className="k">Rank · {QL}</div>
        </div>
      </div>
      <HistoryStrip doneDoy={doneDoy} />
    </div>
  );
}
