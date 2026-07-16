"use client";

import { useEffect, useRef } from "react";
import { registerFx } from "@/app/lib/fx";
import { reduceMotion } from "@/app/lib/helpers";

const COLS = ["#1B1812", "#A98A2F", "#9E2B25", "#FAF7F0", "#C0A050"];

/** Full-screen canvas that renders the paper-scrap and handclap bursts. */
export default function ParticleCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const fit = () => {
      const dpr = window.devicePixelRatio || 1;
      cv.width = window.innerWidth * dpr;
      cv.height = window.innerHeight * dpr;
      cv.style.width = window.innerWidth + "px";
      cv.style.height = window.innerHeight + "px";
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };
    fit();
    window.addEventListener("resize", fit);

    // Paper scraps burst up from the plate on log.
    const scraps = (rect: DOMRect) => {
      if (reduceMotion()) return;
      const cy = rect.top + 8;
      const ps = Array.from({ length: 70 }, () => {
        const cx = rect.left + Math.random() * rect.width;
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.1;
        const v = 4.5 + Math.random() * 6.5;
        return {
          x: cx,
          y: cy,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          g: 0.24,
          rot: Math.random() * 7,
          vr: (Math.random() - 0.5) * 0.45,
          w: 3.5 + Math.random() * 6,
          h: 5 + Math.random() * 8,
          life: 1,
          col: COLS[(Math.random() * COLS.length) | 0],
        };
      });
      const tick = () => {
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        let alive = false;
        ps.forEach((p) => {
          if (p.life <= 0) return;
          alive = true;
          p.x += p.vx;
          p.y += p.vy;
          p.vy += p.g;
          p.vx *= 0.99;
          p.rot += p.vr;
          p.life -= 0.012;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.4));
          ctx.fillStyle = p.col;
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          ctx.restore();
        });
        if (alive) requestAnimationFrame(tick);
        else ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      };
      tick();
    };

    // Handclaps popping up from a point when kudos are given or collected.
    const clap = (cx: number, cy: number) => {
      if (reduceMotion()) return;
      const ps = Array.from({ length: 16 }, () => {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.5;
        const v = 3 + Math.random() * 5;
        return {
          x: cx + (Math.random() - 0.5) * 22,
          y: cy,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          g: 0.17, // pop up, then fall
          rot: (Math.random() - 0.5) * 0.7,
          vr: (Math.random() - 0.5) * 0.22,
          life: 1,
          sz: 16 + Math.random() * 13,
        };
      });
      const tick = () => {
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        let alive = false;
        ps.forEach((p) => {
          if (p.life <= 0) return;
          alive = true;
          p.x += p.vx;
          p.y += p.vy;
          p.vy += p.g;
          p.vx *= 0.99;
          p.rot += p.vr;
          p.life -= 0.02;
          if (p.life <= 0) return;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.35));
          ctx.font = `${p.sz}px serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("👏", 0, 0);
          ctx.restore();
        });
        ctx.globalAlpha = 1;
        if (alive) requestAnimationFrame(tick);
        else ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      };
      tick();
    };

    registerFx({ scraps, clap });
    return () => window.removeEventListener("resize", fit);
  }, []);

  return <canvas className="fx" ref={ref} />;
}
