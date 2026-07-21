// Applause for kudos — one clip (small-crowd cheer + claps), used everywhere.
// How LONG it plays scales with how many kudos landed: a quick burst for a
// single give, up to the full clip for a big haul. Prefers the bundled clip;
// falls back to synthesized applause when it can't load (offline / blocked).
// Must be triggered from a user gesture (a tap) so the browser lets audio run.

const CLIP_SRC: string | null = "/audio/kudos.mp3";
const CLIP_LEN_MS = 2200; // real length of kudos.mp3

let ctx: AudioContext | null = null;
let clip: HTMLAudioElement | null = null;
let clipBroken = false;
let fadeTimer = 0;
let fadeRaf = 0;

// iOS/Safari default web audio to the "playback" session, which INTERRUPTS the
// user's music (Spotify / Apple Music) and never resumes it. Declaring an
// "ambient" session makes our short kudos SFX mix over other audio instead of
// pausing it. No-op where the API (Safari 16.4+) doesn't exist.
type AudioSessionType = "auto" | "playback" | "transient" | "transient-solo" | "ambient" | "play-and-record";
function setAmbientSession(): void {
  if (typeof navigator === "undefined") return;
  try {
    const s = (navigator as Navigator & { audioSession?: { type: AudioSessionType } }).audioSession;
    if (s && s.type !== "ambient") s.type = "ambient";
  } catch {
    /* unsupported — nothing to do */
  }
}

// Per-device preference for the kudos applause. On by default; the Settings
// drawer flips it. Stored in localStorage so it survives reloads. Gates every
// kudos sound — giving, receiving, and the preview.
const SND_KEY = "frens_kudos_sound";

export function isKudosSoundOn(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(SND_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setKudosSoundOn(on: boolean): void {
  try {
    localStorage.setItem(SND_KEY, on ? "on" : "off");
  } catch {
    /* private mode / storage disabled — the sound just isn't remembered */
  }
}

/**
 * Warm the kudos audio early (call once on app mount). A fresh `new Audio()`
 * isn't downloaded/decoded yet, so the very first play after a cold open
 * stutters or drops — by the second play it's buffered and fine. Creating and
 * loading the clip up front makes the first real play warm too. (iOS still
 * unlocks output on the first gesture-driven play, which the first kudos tap
 * provides.)
 */
export function initKudosAudio(): void {
  if (typeof window === "undefined") return;
  setAmbientSession(); // declare "mix, don't interrupt" before any audio starts
  if (CLIP_SRC && !clip) {
    try {
      clip = new Audio(CLIP_SRC);
      clip.preload = "auto";
      clip.load();
    } catch {
      /* best-effort — playKudos still works, just cold the first time */
    }
  }
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      setAmbientSession(); // set the session type before the context adopts it
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Play length for a given kudos count: ~1s for one, up to the full clip. */
function scaledDurationMs(count: number): number {
  const c = Math.max(1, Math.floor(count) || 1);
  return Math.min(CLIP_LEN_MS, 1000 + (c - 1) * 300);
}

function clearFade() {
  if (fadeTimer) {
    clearTimeout(fadeTimer);
    fadeTimer = 0;
  }
  if (fadeRaf) {
    cancelAnimationFrame(fadeRaf);
    fadeRaf = 0;
  }
}

/** Fade the clip out and stop it at `durMs`, unless that's basically the whole
 *  clip (then let it end on its own). */
function scheduleClipFade(durMs: number) {
  clearFade();
  if (durMs >= CLIP_LEN_MS - 150 || typeof performance === "undefined") return;
  const fadeMs = 280;
  fadeTimer = window.setTimeout(() => {
    if (!clip) return;
    const start = performance.now();
    const v0 = clip.volume;
    const tick = (now: number) => {
      if (!clip) return;
      const k = Math.min(1, (now - start) / fadeMs);
      clip.volume = Math.max(0, v0 * (1 - k));
      if (k < 1) {
        fadeRaf = requestAnimationFrame(tick);
      } else {
        clip.pause();
        clip.currentTime = 0;
        clip.volume = v0;
        fadeRaf = 0;
      }
    };
    fadeRaf = requestAnimationFrame(tick);
  }, Math.max(50, durMs - fadeMs));
}

function noiseBuffer(ac: AudioContext, dur: number): AudioBuffer {
  const buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

/** One hand clap: a very short noise smack — sharp attack, fast decay, high-passed
 *  with a peak around 1.6 kHz so it reads as a clap, not a hiss. */
function oneClap(ac: AudioContext, t: number, gain: number) {
  const dur = 0.05;
  const buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    const env = Math.pow(1 - i / d.length, 6);
    d[i] = (Math.random() * 2 - 1) * env;
  }
  const src = ac.createBufferSource();
  src.buffer = buf;
  const hp = ac.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 900;
  const peak = ac.createBiquadFilter();
  peak.type = "peaking";
  peak.frequency.value = 1600;
  peak.gain.value = 6;
  peak.Q.value = 1;
  const g = ac.createGain();
  g.gain.value = gain;
  src.connect(hp).connect(peak).connect(g).connect(ac.destination);
  src.start(t);
  src.stop(t + dur);
}

/** A soft crowd "wooo" swell behind the claps. */
function cheer(ac: AudioContext, t: number, durS: number) {
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac, durS);
  const bp = ac.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 1.2;
  bp.frequency.setValueAtTime(680, t);
  bp.frequency.linearRampToValueAtTime(1150, t + durS * 0.5);
  bp.frequency.linearRampToValueAtTime(820, t + durS);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.13, t + Math.min(0.2, durS * 0.3));
  g.gain.linearRampToValueAtTime(0.0001, t + durS);
  src.connect(bp).connect(g).connect(ac.destination);
  src.start(t);
  src.stop(t + durS);
}

/** Synthesized round of applause, scaled to the kudos count. */
function synthApplause(count: number) {
  const ac = audio();
  if (!ac) return;
  const now = ac.currentTime;
  const durS = scaledDurationMs(count) / 1000;
  cheer(ac, now, durS);
  const N = Math.min(28, 9 + Math.round((count - 1) * 2.5));
  const spread = Math.max(0.3, durS - 0.3);
  for (let i = 0; i < N; i++) {
    const t = now + (i / N) * spread + Math.random() * 0.03;
    const gain = Math.max(0.1, 0.5 - (i / N) * 0.25 + Math.random() * 0.12);
    oneClap(ac, t, gain);
  }
}

/**
 * Play the kudos applause, its length scaled to `count`. Silent when the user
 * has muted kudos sounds. Prefers the bundled clip; falls back to synthesis.
 * Returns the applause duration in ms (even when muted), so visuals — the 👏
 * stream — can sync to the same window.
 */
export function playKudos(count = 1): number {
  const dur = scaledDurationMs(count);
  if (!isKudosSoundOn()) return dur;
  setAmbientSession(); // keep other apps' music playing under the clip
  if (CLIP_SRC && !clipBroken) {
    try {
      if (!clip) {
        clip = new Audio(CLIP_SRC);
        clip.preload = "auto";
      }
      clearFade();
      clip.volume = 0.9;
      clip.currentTime = 0;
      const p = clip.play();
      scheduleClipFade(dur);
      if (p && typeof p.then === "function") {
        p.catch(() => {
          clipBroken = true; // missing / offline / blocked — synth from now on
          clearFade();
          synthApplause(count);
        });
      }
      return dur;
    } catch {
      clipBroken = true;
      clearFade();
    }
  }
  synthApplause(count);
  return dur;
}
