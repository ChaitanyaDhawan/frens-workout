"use client";

import { useEffect, useRef } from "react";
import { registerFx } from "@/app/lib/fx";
import { reduceMotion } from "@/app/lib/helpers";

const COLS = ["#1B1812", "#A98A2F", "#9E2B25", "#FAF7F0", "#C0A050"];

/** Full-screen canvas that renders the paper-scrap and fire-ember bursts. */
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

    // Fiery embers rising from a point on a like tap.
    const fire = (cx: number, cy: number) => {
      if (reduceMotion()) return;
      const ps = Array.from({ length: 26 }, () => {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.3;
        const v = 1.8 + Math.random() * 4.2;
        return {
          x: cx + (Math.random() - 0.5) * 14,
          y: cy,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          g: -0.045 - Math.random() * 0.05, // negative gravity: heat rises
          wob: Math.random() * 6.28,
          life: 1,
          sz: 1.6 + Math.random() * 3.2,
          hue: 8 + Math.random() * 38,
        };
      });
      const tick = () => {
        let alive = false;
        ps.forEach((p) => {
          if (p.life <= 0) return;
          alive = true;
          p.wob += 0.3;
          p.x += p.vx + Math.sin(p.wob) * 0.5;
          p.y += p.vy;
          p.vy += p.g;
          p.life -= 0.022;
          if (p.life <= 0) return;
          ctx.globalAlpha = Math.max(0, p.life);
          ctx.fillStyle = `hsl(${p.hue + (1 - p.life) * 20} 100% ${50 + p.life * 22}%)`;
          ctx.shadowColor = "#FF6A1F";
          ctx.shadowBlur = 9;
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0.1, p.sz * p.life), 0, 7);
          ctx.fill();
        });
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        if (alive) {
          requestAnimationFrame(() => {
            ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
            tick();
          });
        } else {
          ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        }
      };
      tick();
    };

    registerFx({ scraps, fire });
    return () => window.removeEventListener("resize", fit);
  }, []);

  return <canvas className="fx" ref={ref} />;
}
