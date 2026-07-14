"use client";

import { useStore } from "@/app/lib/store";
import { pad, rankOf, streakNow } from "@/app/lib/helpers";
import FlapCounter from "./FlapCounter";
import Flame from "./Flame";
import WeekStrip from "./WeekStrip";

/** Home "Your Q3" tile — entries (solari), streak, rank, week strip. Taps to You. */
export default function StatsTile() {
  const { me, frens, doneDoy, rollTick, bounceTick, setTab } = useStore();
  const streak = streakNow(doneDoy);
  const rank = rankOf(frens, "Chaitanya", "q3");

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
      <div className="t-top">
        <span className="t-eyebrow">Your Q3</span>
        <span className="t-link">Your ledger →</span>
      </div>
      <div className="t-body">
        <div>
          <FlapCounter className="t-flaps" value={me.q3} rollKey={rollTick} />
          <div className="t-cap">Entries</div>
        </div>
        <div className="t-div" />
        <div className="t-stat">
          <div className="v">
            <Flame lit={streak > 0} bounceTick={bounceTick} />
            <span>{streak}</span>
          </div>
          <div className="k">Day streak</div>
        </div>
        <div className="t-div" />
        <div className="t-stat">
          <div className="v">{"#" + pad(rank)}</div>
          <div className="k">Rank · Q3</div>
        </div>
      </div>
      <WeekStrip doneDoy={doneDoy} containerClass="t-week" />
    </div>
  );
}
