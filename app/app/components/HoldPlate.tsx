"use client";

import { useRef, useState } from "react";
import { useStore } from "@/app/lib/store";
import { fx } from "@/app/lib/fx";
import { MONTHS, TODAY_D, TODAY_M } from "@/app/lib/data";

const HOLD = 600; // ms to complete a hold
const TODAY_LABEL = `${MONTHS[TODAY_M].n.slice(0, 3)} ${TODAY_D}`;

interface PlusOne {
  id: number;
  left: number;
  top: number;
}

/** Fixed dock with the hold-to-log plate (Home + Board only). */
export default function HoldPlate() {
  const { tab, logged, logToday } = useStore();
  const plateRef = useRef<HTMLButtonElement>(null);
  const rafRef = useRef(0);
  const heldRef = useRef(false);
  const t0Ref = useRef(0);
  const [p, setP] = useState(0);
  const [plusones, setPlusones] = useState<PlusOne[]>([]);

  const complete = () => {
    heldRef.current = false;
    setP(0);
    navigator.vibrate?.([12, 40, 18]);
    const plate = plateRef.current;
    if (plate) {
      const r = plate.getBoundingClientRect();
      const id = Date.now() + Math.random();
      setPlusones((list) => [...list, { id, left: r.left + r.width / 2 - 12, top: r.top - 6 }]);
      setTimeout(() => setPlusones((list) => list.filter((x) => x.id !== id)), 1200);
      fx.scraps(r);
    }
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
    <>
      <div className="dock" style={{ display: tab === "you" ? "none" : "flex" }}>
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
      {plusones.map((po) => (
        <div key={po.id} className="plusone" style={{ left: po.left, top: po.top }}>
          +1
        </div>
      ))}
    </>
  );
}
