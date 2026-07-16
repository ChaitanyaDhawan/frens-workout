"use client";

import { useRef } from "react";
import { motion } from "motion/react";
import { useStore } from "@/app/lib/store";
import { initials } from "@/app/lib/helpers";

const SHEET_EASE: [number, number, number, number] = [0.3, 1.15, 0.35, 1];

/** Bottom sheet listing everyone who gave kudos on a workout. */
export default function KudosSheet() {
  const { kudosSheet, feed, openProfile, closeKudosSheet } = useStore();
  const snap = useRef(kudosSheet);
  if (kudosSheet) snap.current = kudosSheet;
  const workoutId = snap.current;
  const item = workoutId ? feed.find((f) => f.id === workoutId) : undefined;
  const givers = item?.likers ?? [];

  return (
    <motion.div
      className="sheet csheet"
      style={{ x: "-50%" }}
      initial={{ y: "105%" }}
      animate={{ y: 0 }}
      exit={{ y: "105%" }}
      transition={{ duration: 0.4, ease: SHEET_EASE }}
    >
      <div className="shead">
        <h2>Kudos 👏</h2>
      </div>
      {item && <div className="cmt-sub">{`${item.n} · ${item.act ?? "Workout"}`}</div>}

      <div className="cmt-list">
        {givers.length === 0 ? (
          <div className="cmt-empty">No kudos yet — be the first 👏</div>
        ) : (
          givers.map((n, i) => (
            <div
              className="cmt"
              key={`${n}-${i}`}
              onClick={() => {
                closeKudosSheet();
                openProfile(n);
              }}
              style={{ cursor: "pointer" }}
            >
              <div className="cmt-ava">{initials(n)}</div>
              <div className="cmt-b">
                <div className="cmt-h">
                  <span className="cmt-name">{n}</span>
                </div>
                <div className="cmt-text" style={{ color: "var(--ox)" }}>
                  gave kudos 👏
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}
