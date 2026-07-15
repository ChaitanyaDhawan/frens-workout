"use client";

import { useRef, useState } from "react";
import { useStore } from "@/app/lib/store";
import { MONTHS, TODAY_D, TODAY_M } from "@/app/lib/data";

const HOLD = 600; // ms to complete a hold
const TODAY_LABEL = `${MONTHS[TODAY_M].n.slice(0, 3)} ${TODAY_D}`;

/** Fixed dock with the hold-to-log plate (Home + Board only). */
export default function HoldPlate() {
  const { tab, logged, logToday } = useStore();
  const plateRef = useRef<HTMLButtonElement>(null);
  const rafRef = useRef(0);
  const heldRef = useRef(false);
  const t0Ref = useRef(0);
  const [p, setP] = useState(0);

  // A completed hold opens the log sheet — the entry itself is created on submit.
  const complete = () => {
    heldRef.current = false;
    setP(0);
    navigator.vibrate?.([12, 40, 18]);
    logToday();
  };

  const step = (ts: number) => {
    const pct = Math.min(100, ((ts - t0Ref.current) / HOLD) * 100);
    setP(pct);
    if (pct >= 100) {
      complete();
      return;
    }
    rafRef.current = requestAnimationFrame(step);
  };

  const onDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (logged) return;
    heldRef.current = true;
    plateRef.current?.setPointerCapture(e.pointerId);
    t0Ref.current = performance.now();
    rafRef.current = requestAnimationFrame(step);
    navigator.vibrate?.(8);
  };

  const cancelHold = () => {
    if (!heldRef.current) return;
    heldRef.current = false;
    cancelAnimationFrame(rafRef.current);
    setP(0);
  };

  return (
    <div className={`dock${logged ? " logged" : ""}`} style={{ display: tab === "you" ? "none" : "flex" }}>
      <button
        ref={plateRef}
        className={`plate${logged ? " done" : ""}`}
        style={{ ["--p" as string]: p } as React.CSSProperties}
        onPointerDown={onDown}
        onPointerUp={cancelHold}
        onPointerCancel={cancelHold}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span className="fill" />
        <span className="lbl">{logged ? `✓ On the record · ${TODAY_LABEL}` : "Hold to log today"}</span>
      </button>
    </div>
  );
}
