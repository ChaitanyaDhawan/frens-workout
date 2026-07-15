"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useStore } from "@/app/lib/store";

const THRESHOLD = 66; // px pulled before a refresh fires
const MAX = 96;

/** The app's single scroll container, with custom pull-to-refresh (the locked
 *  app-shell disables the browser's native one). Works on Home, Board, and You. */
export default function ScrollArea({ children }: { children: ReactNode }) {
  const { refresh, tab } = useStore();
  const ref = useRef<HTMLDivElement>(null);
  const startY = useRef<number | null>(null);

  // Every tab switch starts at the top — don't carry over the old scroll position.
  useEffect(() => {
    ref.current?.scrollTo({ top: 0 });
  }, [tab]);
  const [pull, setPull] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onTouchStart = (e: React.TouchEvent) => {
    if (refreshing) return;
    const el = ref.current;
    startY.current = el && el.scrollTop <= 0 ? e.touches[0].clientY : null;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current == null || refreshing) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy <= 0) {
      if (pull !== 0) setPull(0);
      setDragging(false);
      return;
    }
    setDragging(true);
    setPull(Math.min(MAX, dy * 0.5)); // resistance
  };

  const onTouchEnd = async () => {
    if (startY.current == null) {
      setDragging(false);
      return;
    }
    startY.current = null;
    setDragging(false);
    if (pull >= THRESHOLD && !refreshing) {
      setRefreshing(true);
      setPull(THRESHOLD);
      try {
        await refresh();
      } finally {
        setPull(0);
        setTimeout(() => setRefreshing(false), 300);
      }
    } else {
      setPull(0);
    }
  };

  return (
    <div
      className="scroll"
      ref={ref}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      <div className={`ptr${dragging ? " dragging" : ""}`} style={{ height: refreshing ? THRESHOLD : pull }}>
        <span
          className={`ptr-ico${refreshing ? " spin" : ""}`}
          style={refreshing ? undefined : { transform: `rotate(${Math.round(pull * 4)}deg)` }}
        />
      </div>
      {children}
    </div>
  );
}
