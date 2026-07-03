// Designed placeholder canvas for paintings whose images are not freely
// licensed: the full Wikipedia metadata hangs on the wall, drawn in the site's
// engraved-placard idiom on a linen-toned canvas.

import * as THREE from "three";
import type { MuseumPainting } from "@/lib/museum";

const PX_PER_M = 420;

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const attempt = line ? `${line} ${word}` : word;
    if (ctx.measureText(attempt).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = attempt;
    }
  }
  if (line) {
    lines.push(line);
  }
  return lines;
}

export function makePlaceholderTexture(
  painting: MuseumPainting,
  canvasW: number,
  canvasH: number,
): THREE.CanvasTexture {
  const w = Math.round(canvasW * PX_PER_M);
  const h = Math.round(canvasH * PX_PER_M);
  const el = document.createElement("canvas");
  el.width = w;
  el.height = h;
  const ctx = el.getContext("2d")!;

  // Aged linen ground with a soft vignette.
  ctx.fillStyle = "#e4dbc4";
  ctx.fillRect(0, 0, w, h);
  const vign = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.72);
  vign.addColorStop(0, "rgba(255,251,238,0.28)");
  vign.addColorStop(1, "rgba(87,71,41,0.22)");
  ctx.fillStyle = vign;
  ctx.fillRect(0, 0, w, h);

  // Faint weave.
  ctx.strokeStyle = "rgba(120,104,74,0.05)";
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 4) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += 4) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Double hairline frame, the atlas-plate idiom.
  const m = Math.min(w, h) * 0.06;
  ctx.strokeStyle = "rgba(110,99,83,0.75)";
  ctx.lineWidth = Math.max(1.5, w / 700);
  ctx.strokeRect(m, m, w - 2 * m, h - 2 * m);
  ctx.strokeStyle = "rgba(110,99,83,0.4)";
  ctx.strokeRect(m * 1.35, m * 1.35, w - 2.7 * m, h - 2.7 * m);

  const cx = w / 2;
  const base = Math.min(w, h);
  ctx.textAlign = "center";
  ctx.fillStyle = "#4a4234";

  // Title, letterspaced caps (canvas has no letter-spacing; space the glyphs).
  const titleSize = Math.max(base * 0.055, 22);
  ctx.font = `600 ${titleSize}px "Cormorant Garamond", Georgia, serif`;
  const spaced = painting.title.toUpperCase().split("").join("  ");
  const titleLines = wrap(ctx, spaced, w - 3.2 * m);
  let y = h / 2 - (titleLines.length - 1) * titleSize * 0.75 - base * 0.04;
  for (const line of titleLines.slice(0, 4)) {
    ctx.fillText(line, cx, y, w - 2.8 * m);
    y += titleSize * 1.5;
  }

  // Year.
  if (painting.yearDisplay) {
    ctx.font = `italic ${Math.max(base * 0.042, 17)}px "Cormorant Garamond", Georgia, serif`;
    ctx.fillStyle = "#6e6353";
    ctx.fillText(painting.yearDisplay, cx, y + base * 0.015);
    y += base * 0.075;
  }

  // Rule.
  ctx.strokeStyle = "rgba(110,99,83,0.6)";
  ctx.lineWidth = Math.max(1, w / 900);
  ctx.beginPath();
  ctx.moveTo(cx - base * 0.09, y);
  ctx.lineTo(cx + base * 0.09, y);
  ctx.stroke();
  y += base * 0.07;

  // The honest small print.
  ctx.font = `500 ${Math.max(base * 0.026, 12)}px "Cormorant Garamond", Georgia, serif`;
  ctx.fillStyle = "#7d7260";
  ctx.fillText("I M A G E   N O T   F R E E L Y   A V A I L A B L E", cx, y);
  y += base * 0.045;
  ctx.font = `italic ${Math.max(base * 0.028, 12)}px "Cormorant Garamond", Georgia, serif`;
  ctx.fillText("still under copyright — step closer to read its story", cx, y);

  const tex = new THREE.CanvasTexture(el);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
