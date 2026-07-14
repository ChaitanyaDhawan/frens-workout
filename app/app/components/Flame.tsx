"use client";

import { useEffect, useRef } from "react";

interface FlameProps {
  lit: boolean;
  /** From the store — increments to trigger a one-shot bounce. */
  bounceTick: number;
  className?: string;
}

export default function Flame({ lit, bounceTick, className = "flame" }: FlameProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const el = ref.current;
    if (!el) return;
    el.classList.remove("bounce");
    // Force reflow so re-adding the class restarts the animation.
    void el.offsetWidth;
    el.classList.add("bounce");
    const t = setTimeout(() => el.classList.remove("bounce"), 720);
    return () => clearTimeout(t);
  }, [bounceTick]);

  return (
    <span ref={ref} className={`${className}${lit ? " lit" : ""}`}>
      🔥
    </span>
  );
}
