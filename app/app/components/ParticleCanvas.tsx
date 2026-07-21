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

    // iMessage-echo-style celebration, built around three things the real one
    // does: DEPTH (mixed sizes; big foreground emoji launch faster than small
    // background ones — parallax), a dense wave SYNCED to the sound's attack,
    // and DECELERATION into a readable hang before a staggered fade. Perf: the
    // emoji rasterizes ONCE into a sprite; motion is delta-time based.
    const emojiRain = (emoji: string, durMs = 900) => {
      if (reduceMotion()) return;
      const W = () => window.innerWidth;
      const H = () => window.innerHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const SPRITE = 96;
      const sprite = document.createElement("canvas");
      sprite.width = sprite.height = SPRITE * dpr;
      const sctx = sprite.getContext("2d");
      if (!sctx) return;
      sctx.scale(dpr, dpr);
      sctx.font = `${SPRITE * 0.82}px serif`;
      sctx.textAlign = "center";
      sctx.textBaseline = "middle";
      sctx.fillText(emoji, SPRITE / 2, SPRITE / 2 + 3);

      const N = Math.max(24, Math.min(52, Math.round(durMs / 28)));
      const spawnSpan = durMs * 0.5; // the whole wave launches with the sound's attack
      const ps = Array.from({ length: N }, (_, i) => {
        const depth = Math.random(); // 0 = far background, 1 = foreground
        return {
          x: 14 + Math.random() * (W() - 28),
          y: H() + 40,
          v: 480 + depth * 640 + Math.random() * 80, // foreground launches faster
          vMin: 55 + depth * 65, // and hangs a touch livelier
          depth,
          sz: 20 + depth * 42, // 20px (far) → 62px (near)
          tilt: (Math.random() - 0.5) * 0.3, // static organic tilt, no spin
          delayMs: (i / Math.max(1, N - 1)) * spawnSpan + Math.random() * 36,
          bornAt: 0,
          life: 1,
        };
      });
      const DECAY = 2.7; // 1/sec — launch speed bleeds into the hang
      const EVAP_AT = 820; // ms afloat before evaporating (staggered by depth)
      let last = performance.now();
      const tick = (now: number) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        ctx.clearRect(0, 0, W(), H());
        let alive = false;
        // background first so foreground draws over it — cheap painter's sort
        for (const p of ps) {
          if (p.life <= 0) continue;
          if (p.delayMs > 0) {
            p.delayMs -= dt * 1000;
            alive = true;
            continue;
          }
          if (!p.bornAt) p.bornAt = now;
          alive = true;
          const age = now - p.bornAt;
          // Three beats: rocket launch → decelerated readable hang → EVAPORATE
          // (whoosh back up to speed while dissolving fast — no lingering crawl).
          const evap = age > EVAP_AT + p.depth * 220 || p.y < H() * 0.14;
          if (evap) {
            p.v += (900 - p.v) * Math.min(1, 6 * dt); // re-accelerate upward
            p.life -= dt * 4.2; // ~240ms dissolve
          } else {
            p.v += (p.vMin - p.v) * Math.min(1, DECAY * dt);
          }
          p.y -= p.v * dt;
          if (p.y < -80) p.life = 0;
          if (p.life <= 0) continue;
          const inK = Math.min(1, age / 130);
          const pop = inK < 1 ? 0.55 + 0.45 * (1 + 2.2 * (inK - 1) * (inK - 1) * (inK - 1) + 2.2 * (inK - 1) * (inK - 1)) : 1;
          // evaporating emoji puff slightly larger as they dissolve
          const s = p.sz * pop * (evap ? 1 + (1 - Math.max(0, p.life)) * 0.35 : 1);
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.tilt);
          ctx.globalAlpha = Math.min(1, Math.min(inK * 1.8, Math.max(0, p.life)) * (0.55 + 0.45 * p.depth));
          ctx.drawImage(sprite, -s / 2, -s / 2, s, s);
          ctx.restore();
        }
        ctx.globalAlpha = 1;
        if (alive) requestAnimationFrame(tick);
        else ctx.clearRect(0, 0, W(), H());
      };
      requestAnimationFrame(tick);
    };

    registerFx({ scraps, clap, emojiRain });
    return () => window.removeEventListener("resize", fit);
  }, []);

  return <canvas className="fx" ref={ref} />;
}
