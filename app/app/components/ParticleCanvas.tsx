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

    // iMessage-style tapback celebration: a staggered stream of one emoji
    // rising straight up from the bottom. Smoothness notes: the emoji is
    // rasterized ONCE into a sprite (fillText of color emoji every frame is
    // what janks phones), motion is delta-time based (frame drops don't
    // stutter the speed), and each particle eases in (scale+fade) at spawn.
    const emojiRain = (emoji: string, durMs = 900) => {
      if (reduceMotion()) return;
      const W = () => window.innerWidth;
      const H = () => window.innerHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const SPRITE = 64;
      const sprite = document.createElement("canvas");
      sprite.width = sprite.height = SPRITE * dpr;
      const sctx = sprite.getContext("2d");
      if (!sctx) return;
      sctx.scale(dpr, dpr);
      sctx.font = `${SPRITE * 0.82}px serif`;
      sctx.textAlign = "center";
      sctx.textBaseline = "middle";
      sctx.fillText(emoji, SPRITE / 2, SPRITE / 2 + 2);

      // Spawns spread across the sound's window (last one ~75% in, so the
      // tail clears as the applause fades); a longer applause = a fuller stream.
      // Dense on purpose — sprite stamping is cheap, and a thick stream of
      // claps is the moment. (~29 for a single kudos, up to 50 for a big haul.)
      const N = Math.max(20, Math.min(50, Math.round(durMs / 35)));
      const spawnSpan = durMs * 0.75;
      const ps = Array.from({ length: N }, (_, i) => ({
        x: 20 + Math.random() * (W() - 40),
        y: H() + 30,
        v: 520 + Math.random() * 260, // px/sec, straight up
        sz: 26 + Math.random() * 18,
        delayMs: (i / Math.max(1, N - 1)) * spawnSpan + Math.random() * 45,
        bornAt: 0, // set when the delay elapses (for the spawn pop-in)
        phase: Math.random() * Math.PI * 2,
        swayAmp: 4 + Math.random() * 5, // gentle coherent sway — floaty, not random
        life: 1,
      }));
      // Bouncy pop-in: overshoots ~1.1 then settles — reads as fun, not mechanical.
      const backOut = (k: number) => {
        const c = 1.70158;
        const t = k - 1;
        return 1 + (c + 1) * t * t * t + c * t * t;
      };
      let last = performance.now();
      const tick = (now: number) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        ctx.clearRect(0, 0, W(), H());
        let alive = false;
        ps.forEach((p) => {
          if (p.life <= 0) return;
          if (p.delayMs > 0) {
            p.delayMs -= dt * 1000;
            alive = true;
            return;
          }
          if (!p.bornAt) p.bornAt = now;
          alive = true;
          p.y -= p.v * dt;
          p.phase += dt * 4.2;
          const inK = Math.min(1, (now - p.bornAt) / 200);
          if (p.y < H() * 0.36) p.life -= dt * 2.4;
          if (p.y < -60) p.life = 0;
          if (p.life <= 0) return;
          const sway = Math.sin(p.phase) * p.swayAmp;
          const tilt = Math.sin(p.phase) * 0.13; // leans into the sway
          const a = Math.min(inK * 1.6, Math.max(0, p.life));
          const s = p.sz * (0.5 + 0.5 * backOut(inK));
          ctx.save();
          ctx.translate(p.x + sway, p.y);
          ctx.rotate(tilt);
          ctx.globalAlpha = Math.min(1, a);
          ctx.drawImage(sprite, -s / 2, -s / 2, s, s);
          ctx.restore();
        });
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
