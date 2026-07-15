// Renders a shareable "record card" PNG for a just-logged workout and hands it
// to the native share sheet (falling back to a download). Canvas-drawn so it
// needs no server; uses a bold system stack (Archivo isn't reliably nameable in
// canvas via next/font).

export interface ShareCardInput {
  name: string;
  headline: string;
  activity: string;
  dateLabel: string;
  stats: { label: string; value: string }[];
}

const PAPER = "#F3EFE6";
const INK = "#1B1812";
const OX = "#9E2B25";
const GOLD = "#C0A050";
const MUT = "#8A8375";
const SANS = '"Helvetica Neue", Arial, sans-serif';

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function makeShareCard(input: ShareCardInput): Promise<void> {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // background + frame
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.strokeRect(46, 46, W - 92, H - 92);

  // eyebrow
  ctx.fillStyle = MUT;
  ctx.font = `600 26px ${SANS}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText("F R E N S   W O R K O U T   ·   O N   T H E   R E C O R D", 96, 150);

  // wordmark
  ctx.fillStyle = INK;
  ctx.font = `900 118px ${SANS}`;
  ctx.fillText("FRENS", 92, 300);
  ctx.fillText("WORKOUT", 92, 420);
  const ww = ctx.measureText("WORKOUT").width;
  ctx.fillStyle = OX;
  ctx.fillRect(92 + ww + 14, 400, 22, 22);

  // crest
  const crest = await loadImage("/icons/icon-512.png");
  if (crest) ctx.drawImage(crest, W - 340, 140, 250, 250);

  // divider
  ctx.strokeStyle = "#DCD5C6";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(96, 470);
  ctx.lineTo(W - 96, 470);
  ctx.stroke();

  // name + activity
  ctx.fillStyle = OX;
  ctx.font = `800 40px ${SANS}`;
  ctx.fillText(`${input.name}  ·  ${input.activity}`, 96, 560);

  // headline (wrap)
  ctx.fillStyle = INK;
  ctx.font = `900 84px ${SANS}`;
  wrap(ctx, input.headline, 96, 680, W - 200, 92);

  // date
  ctx.fillStyle = MUT;
  ctx.font = `600 30px ${SANS}`;
  ctx.fillText(input.dateLabel.toUpperCase(), 96, 900);

  // stats row
  const stats = input.stats.slice(0, 4);
  const gap = 30;
  const boxW = (W - 192 - gap * (stats.length - 1)) / stats.length;
  stats.forEach((s, i) => {
    const x = 96 + i * (boxW + gap);
    const y = 960;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, boxW, 200);
    ctx.fillStyle = INK;
    ctx.font = `900 68px ${SANS}`;
    ctx.textAlign = "center";
    ctx.fillText(s.value, x + boxW / 2, y + 110);
    ctx.fillStyle = MUT;
    ctx.font = `600 22px ${SANS}`;
    ctx.fillText(s.label.toUpperCase(), x + boxW / 2, y + 160);
    ctx.textAlign = "left";
  });

  // footer
  ctx.fillStyle = GOLD;
  ctx.fillRect(96, H - 150, W - 192, 5);
  ctx.fillStyle = MUT;
  ctx.font = `600 26px ${SANS}`;
  ctx.textAlign = "center";
  ctx.fillText("EST. 2026  ·  FRENS ATHLETIC CLUB", W / 2, H - 100);
  ctx.textAlign = "left";

  const blob = await new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), "image/png"));
  if (!blob) return;
  const file = new File([blob], "frens-workout.png", { type: "image/png" });

  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "FRENS Workout" });
      return;
    } catch {
      /* user cancelled — fall through to download */
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "frens-workout.png";
  a.click();
  URL.revokeObjectURL(url);
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number) {
  const words = text.split(" ");
  let line = "";
  let yy = y;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = w;
      yy += lh;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}
