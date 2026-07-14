"use client";

import { motion } from "motion/react";
import { useStore } from "@/app/lib/store";
import { fmtDate } from "@/app/lib/helpers";
import type { WorkoutDetail } from "@/app/lib/data";

const SHEET_EASE: [number, number, number, number] = [0.3, 1.15, 0.35, 1];

function hasDetails(dd?: WorkoutDetail): dd is WorkoutDetail {
  return !!dd && ((dd.types && dd.types.length > 0) || !!dd.dur || !!dd.note || dd.photo);
}

function DayBody({ dd }: { dd?: WorkoutDetail }) {
  if (!hasDetails(dd)) {
    return <div className="daynone">No details on this one — just the ✓.</div>;
  }
  return (
    <>
      {((dd.types && dd.types.length > 0) || dd.dur) && (
        <div className="daytags">
          {dd.types.map((t) => (
            <span className="daytag" key={t}>
              {t}
            </span>
          ))}
          {dd.dur && <span className="daytag alt">{dd.dur}</span>}
        </div>
      )}
      {dd.note && <div className="daynote">{dd.note}</div>}
      {dd.photo && <div className="dsphoto">PROOF ATTACHED</div>}
    </>
  );
}

/** Read-only view of a logged day with Edit / Delete actions. */
export default function DayDetailSheet() {
  const { daySheet, dayData, openSheet, removeDay } = useStore();
  const doy = daySheet!.doy;
  const dd = dayData[doy];

  return (
    <motion.div
      className="sheet"
      style={{ x: "-50%" }}
      initial={{ y: "105%" }}
      animate={{ y: 0 }}
      exit={{ y: "105%" }}
      transition={{ duration: 0.4, ease: SHEET_EASE }}
    >
      <div className="shead">
        <h2>{fmtDate(doy)}</h2>
      </div>
      <div className="sub2">Your workout entry</div>
      <div>
        <DayBody dd={dd} />
      </div>
      <div className="btnrow">
        <button className="skipbtn" onClick={() => openSheet("edit", doy)}>
          Edit details
        </button>
        <button
          className="delbtn"
          onClick={() => removeDay(doy)}
        >
          Delete entry
        </button>
      </div>
    </motion.div>
  );
}
