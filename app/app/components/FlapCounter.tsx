"use client";

import { useEffect, useRef } from "react";

interface FlapCounterProps {
  value: number;
  /** Wrapper class — "t-flaps" (Home tile) or "flaps" (Board rows). */
  className: string;
  /** When this changes, the counter rolls (counts up) to `value`. */
  rollKey?: number;
  /** When this changes, changed digits flip once in place to `value`. */
  flipKey?: number;
  /** Minimum number of tiles; widens automatically for 3+ digit values. */
  digits?: number;
}

/**
 * Split-flap ("solari") counter. Renders a set of `.tile` cells (at least
 * `digits`, more when the value needs them) and animates them imperatively so
 * React never fights the in-flight DOM text.
 */
export default function FlapCounter({ value, className, rollKey, flipKey, digits = 2 }: FlapCounterProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);
  const prevValue = useRef(value);
  const prevRoll = useRef(rollKey);
  const prevFlip = useRef(flipKey);
  const gen = useRef(0);

  const width = Math.max(digits, String(Math.max(0, Math.trunc(value))).length);
  const fmt = (n: number) => String(Math.max(0, Math.trunc(n))).padStart(width, "0");

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    const tiles = container.querySelectorAll<HTMLElement>(".tile");

    const setInstant = (to: number) => {
      fmt(to)
        .split("")
        .forEach((d, i) => {
          if (tiles[i]) tiles[i].textContent = d;
        });
    };

    if (!mounted.current) {
      setInstant(value);
      mounted.current = true;
      prevValue.current = value;
      prevRoll.current = rollKey;
      prevFlip.current = flipKey;
      return;
    }

    const rolled = rollKey !== undefined && rollKey !== prevRoll.current;
    const flipped = flipKey !== undefined && flipKey !== prevFlip.current;
    const changed = value !== prevValue.current;
    prevRoll.current = rollKey;
    prevFlip.current = flipKey;
    prevValue.current = value;
    if (!changed && !rolled && !flipped) return;

    const myGen = ++gen.current;

    if (rolled) {
      const target = fmt(value).split("");
      tiles.forEach((t, i) => {
        const goal = +target[i];
        let cur = +(t.textContent || "0");
        if (cur === goal) return;
        const stepFlip = () => {
          if (myGen !== gen.current) return;
          cur = (cur + 1) % 10;
          t.classList.add("flip");
          setTimeout(() => {
            if (myGen === gen.current) t.textContent = String(cur);
          }, 140);
          setTimeout(() => {
            if (myGen !== gen.current) return;
            t.classList.remove("flip");
            if (cur !== goal) setTimeout(stepFlip, 30);
          }, 300);
        };
        stepFlip();
      });
    } else if (flipped) {
      const target = fmt(value).split("");
      tiles.forEach((t, i) => {
        if (t.textContent === target[i]) return;
        t.classList.add("flip");
        setTimeout(() => {
          if (myGen === gen.current) t.textContent = target[i];
        }, 140);
        setTimeout(() => {
          if (myGen === gen.current) t.classList.remove("flip");
        }, 300);
      });
    } else {
      setInstant(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, rollKey, flipKey]);

  return (
    <div className={className} ref={ref}>
      {Array.from({ length: width }, (_, i) => (
        <div className="tile" key={i} />
      ))}
    </div>
  );
}
