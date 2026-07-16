// Synthesized applause for kudos — no audio asset needed, works offline.
// A short cluster of band-passed noise "claps" that reads as a quick round of
// applause. Must be triggered from a user gesture (the kudos tap) so the
// browser lets the AudioContext run.

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
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

/** One clap: a short burst of band-passed white noise with a fast decay. */
function clap(ac: AudioContext, t: number, gain: number, freq: number) {
  const dur = 0.09;
  const buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    const env = Math.pow(1 - i / d.length, 2.4); // sharp attack, quick tail
    d[i] = (Math.random() * 2 - 1) * env;
  }
  const src = ac.createBufferSource();
  src.buffer = buf;
  const bp = ac.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = freq;
  bp.Q.value = 0.7;
  const g = ac.createGain();
  g.gain.value = gain;
  src.connect(bp).connect(g).connect(ac.destination);
  src.start(t);
  src.stop(t + dur);
}

/** A quick round of applause. Safe to call anywhere; it no-ops if audio isn't
 *  available or the context can't run. */
export function playKudos() {
  const ac = audio();
  if (!ac) return;
  const now = ac.currentTime;
  // a lead clap, then a scattered flurry that thins out — "applause"
  const pattern: [number, number, number][] = [
    [0.0, 0.5, 1900],
    [0.05, 0.34, 1500],
    [0.09, 0.42, 2200],
    [0.15, 0.26, 1700],
    [0.2, 0.32, 2000],
    [0.26, 0.2, 1600],
    [0.32, 0.24, 2100],
    [0.4, 0.15, 1800],
  ];
  for (const [dt, gain, freq] of pattern) {
    clap(ac, now + dt + Math.random() * 0.012, gain, freq);
  }
}
