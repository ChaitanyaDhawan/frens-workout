"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/app/lib/store";
import { useAuth } from "@/app/lib/auth";
import { CURRENT_Q, MONTHS, TODAY_DOY } from "@/app/lib/data";
import { bestStreak, streakNow, val } from "@/app/lib/helpers";
import Flame from "./Flame";
import WeekStrip from "./WeekStrip";
import { FeedCard } from "./Feed";
import AutoLog from "./AutoLog";

const PAGE = 5;

/** My own dispatches below the calendar — paginated in pages of 5. */
function MyDispatches() {
  const { mineFeed } = useStore();
  const [limit, setLimit] = useState(PAGE);
  const shown = mineFeed.slice(0, limit);
  const remaining = mineFeed.length - limit;

  return (
    <div className="mine-sect">
      <div className="mine-h">
        <h2>My dispatches</h2>
        <div className="ln" />
      </div>
      {mineFeed.length === 0 ? (
        <div className="mine-empty">No dispatches yet — log a workout to start your ledger.</div>
      ) : (
        <>
          {shown.map((f) => (
            <FeedCard key={f.id} item={f} mountDelay={null} />
          ))}
          {remaining > 0 && (
            <button className="mine-more" onClick={() => setLimit((l) => l + PAGE)}>
              View all · {remaining} more
            </button>
          )}
        </>
      )}
    </div>
  );
}

/** Animate 0 → `to` once on mount; update instantly on later changes. */
function useCountUp(to: number, ms = 450): number {
  const [v, setV] = useState(0);
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      const t0 = performance.now();
      let raf = 0;
      const tick = (ts: number) => {
        const k = Math.min(1, (ts - t0) / ms);
        const eased = 1 - Math.pow(1 - k, 3);
        setV(Math.round(to * eased));
        if (k < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }
    setV(to);
  }, [to, ms]);
  return v;
}

function StreakHero() {
  const { doneDoy, bounceTick } = useStore();
  const streak = streakNow(doneDoy);
  return (
    <div className="hero">
      <Flame lit={streak > 0} bounceTick={bounceTick} className="hflame flame" />
      <div className="hnum">{streak}</div>
      <div className="hcap">Day streak</div>
      <WeekStrip doneDoy={doneDoy} containerClass="week" />
    </div>
  );
}

function Stats() {
  const { me, doneDoy } = useStore();
  const q = useCountUp(val(me, CURRENT_Q));
  const y = useCountUp(me.q1 + me.q2 + me.q3 + (me.q4 ?? 0));
  const b = useCountUp(bestStreak(doneDoy));
  const kq = useCountUp(me.kudosQ3 ?? 0);
  const ka = useCountUp(me.kudosAll ?? 0);
  return (
    <>
      <div className="stats">
        <div className="stat">
          <div className="v">{q}</div>
          <div className="k">This quarter</div>
        </div>
        <div className="stat">
          <div className="v">{y}</div>
          <div className="k">2026</div>
        </div>
        <div className="stat">
          <div className="v">{b}</div>
          <div className="k">Best streak</div>
        </div>
      </div>
      <div className="stats">
        <div className="stat">
          <div className="v">{kq} 🔥</div>
          <div className="k">Kudos · {CURRENT_Q.toUpperCase()}</div>
        </div>
        <div className="stat">
          <div className="v">{ka} 🔥</div>
          <div className="k">Kudos · all-time</div>
        </div>
      </div>
    </>
  );
}

interface Cell {
  pad: boolean;
  key: string;
  d?: number;
  doy?: number;
  done?: boolean;
  today?: boolean;
  past?: boolean;
  fut?: boolean;
  idx?: number;
}

function DayCell({ c, onClick }: { c: Cell; onClick?: () => void }) {
  const cls = ["day"];
  if (c.done) cls.push("done");
  if (c.today) cls.push("today");
  if (c.past) cls.push("past");
  if (c.fut) cls.push("fut");
  const style = { animation: `dayin .25s ${Math.min((c.idx ?? 0) * 9, 280)}ms both` } as React.CSSProperties;
  return (
    <div
      className={cls.join(" ")}
      style={style}
      data-doy={c.doy}
      data-d={c.d}
      onClick={c.fut ? undefined : onClick}
    >
      <span className="badge" />
      <span className="dnum">{c.d}</span>
    </div>
  );
}

function Calendar() {
  const { calM, doneDoy, prevMonth, nextMonth, openDaySheet, openSheet } = useStore();
  const m = MONTHS[calM];
  let sum = 0;
  doneDoy.forEach((d) => {
    if (d > m.off && d <= m.off + m.days) sum++;
  });

  // Pop the month-sum badge when the count changes.
  const prevSum = useRef(sum);
  const [pop, setPop] = useState(false);
  useEffect(() => {
    if (prevSum.current !== sum) {
      prevSum.current = sum;
      setPop(true);
      const t = setTimeout(() => setPop(false), 470);
      return () => clearTimeout(t);
    }
    prevSum.current = sum;
  }, [sum]);

  const cells: Cell[] = [];
  for (let i = 0; i < m.start; i++) cells.push({ pad: true, key: `p${i}` });
  let nonPad = 0;
  for (let d = 1; d <= m.days; d++) {
    const doy = m.off + d;
    const done = doneDoy.has(doy);
    cells.push({
      pad: false,
      key: `d${doy}`,
      d,
      doy,
      done,
      today: doy === TODAY_DOY,
      past: doy < TODAY_DOY && !done,
      fut: doy > TODAY_DOY,
      idx: nonPad++,
    });
  }

  return (
    <div className="cal">
      <div className="mh">
        <div className="mn">
          {m.n} <span style={{ color: "var(--mut)", fontWeight: 500 }}>2026</span>
          <span className={`msum${sum === 0 ? " zero" : ""}${pop ? " pop" : ""}`}>{sum} this month</span>
        </div>
        <div className="mnav">
          <button className="mbtn" onClick={prevMonth} disabled={calM === 0}>
            ‹
          </button>
          <button className="mbtn" onClick={nextMonth} disabled={calM === MONTHS.length - 1}>
            ›
          </button>
        </div>
      </div>
      <div className="dow">
        <span>M</span>
        <span>T</span>
        <span>W</span>
        <span>T</span>
        <span>F</span>
        <span>S</span>
        <span>S</span>
      </div>
      <div className="days" key={calM}>
        {cells.map((c) =>
          c.pad ? (
            <div className="day pad" key={c.key} />
          ) : (
            <DayCell
              key={c.key}
              c={c}
              onClick={() => {
                if (c.done) openDaySheet(c.doy!);
                else openSheet("log", c.doy!);
              }}
            />
          ),
        )}
      </div>
      <div className="hint">Tap a day to add · tap a ✓ day to remove</div>
    </div>
  );
}

function SignOutRow() {
  const { member, signOut } = useAuth();
  return (
    <div className="signout-row">
      {member && <div className="signout-who">Signed in as {member.display_name}</div>}
      <button className="signout-btn" onClick={() => signOut()}>
        Sign out
      </button>
    </div>
  );
}

export default function You() {
  return (
    <>
      <StreakHero />
      <Stats />
      <Calendar />
      <MyDispatches />
      <AutoLog />
      <SignOutRow />
    </>
  );
}
