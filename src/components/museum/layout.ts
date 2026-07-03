// Pure geometry for the museum hall: one classical room, procedurally sized to
// the artist's painting count. Units are meters; origin at room center, floor
// at y = 0. Visitors enter at +z looking toward the far wall at -z. Paintings
// hang down the right wall, across the far wall, and back up the left wall.

import type { MuseumPainting } from "@/lib/museum";

export const WALL_HEIGHT = 4.2;
export const EYE_HEIGHT = 1.7;
export const HANG_CENTER = 1.55; // painting centerline on the wall
export const FRAME_BORDER = 0.09; // visible moulding width around the canvas
export const FRAME_DEPTH = 0.07;
// Oversized canvases are hung higher so the frame clears the baseboard —
// both museum practice and a z-fight fix: frame and baseboard boxes are
// equally deep, so letting them overlap makes their front faces coplanar
// (flicker). Baseboard is 0.18 high; keep a visible sliver of wall below.
const BASEBOARD_CLEAR = 0.24;

function hangY(frameH: number): number {
  return Math.max(HANG_CENTER, frameH / 2 + BASEBOARD_CLEAR);
}

const ROOM_WIDTH = 9;
const SLOT_GAP = 1.5; // wall run between neighbouring frames
const CORNER_CLEAR = 1.3; // keep frames out of the corners
const MAX_CANVAS_HEIGHT = 2.7; // scale down anything taller (mural-sized)
// Widest hangable canvas: the far wall offers ROOM_WIDTH − 2·CORNER_CLEAR =
// 6.4 m of run. Klimt's Beethoven Frieze is 34 m of real wall — unclamped it
// swallowed the room whole.
const MAX_CANVAS_WIDTH = 5.5;
const FALLBACK_W_CM = 100;
const FALLBACK_H_CM = 80;

export type WallSide = "right" | "far" | "left";

export interface Placement {
  painting: MuseumPainting;
  wall: WallSide;
  /** center of the canvas */
  position: [number, number, number];
  rotationY: number;
  /** outward normal of the wall the painting hangs on, pointing into the room */
  normal: [number, number, number];
  canvasW: number;
  canvasH: number;
  frameW: number;
  frameH: number;
}

export interface Bench {
  position: [number, number, number];
  rotationY: number;
}

export interface MuseumLayout {
  width: number; // x extent
  length: number; // z extent
  placements: Placement[];
  benches: Bench[];
  spawn: [number, number, number];
}

function canvasSize(p: MuseumPainting): { w: number; h: number } {
  let wCm = p.widthCm;
  let hCm = p.heightCm;
  if (!wCm || !hCm || wCm <= 0 || hCm <= 0) {
    // No real dimensions on Wikidata: derive aspect from the image if we have
    // one, at a sightly default size.
    if (p.imgWidth && p.imgHeight) {
      const aspect = p.imgWidth / p.imgHeight;
      hCm = FALLBACK_H_CM;
      wCm = FALLBACK_H_CM * aspect;
    } else {
      wCm = FALLBACK_W_CM;
      hCm = FALLBACK_H_CM;
    }
  } else if (p.imgWidth && p.imgHeight) {
    // When the recorded dimensions disagree hard with the image's own aspect
    // (altarpiece dims vs a full-ensemble photo, plain bad data), stretching
    // the reproduction onto the recorded shape would distort it. Trust the
    // image for shape, keep the recorded area for physical presence; the
    // placard still prints the recorded dimensions as fact.
    const imgAspect = p.imgWidth / p.imgHeight;
    const ratio = wCm / hCm / imgAspect;
    if (ratio > 1.25 || ratio < 0.8) {
      const area = wCm * hCm;
      hCm = Math.sqrt(area / imgAspect);
      wCm = hCm * imgAspect;
    }
  }
  let w = wCm / 100;
  let h = hCm / 100;
  if (h > MAX_CANVAS_HEIGHT) {
    w *= MAX_CANVAS_HEIGHT / h;
    h = MAX_CANVAS_HEIGHT;
  }
  if (w > MAX_CANVAS_WIDTH) {
    h *= MAX_CANVAS_WIDTH / w;
    w = MAX_CANVAS_WIDTH;
  }
  return { w, h };
}

/** Wall run one frame occupies, gap included. */
function slotRun(frameW: number): number {
  return frameW + SLOT_GAP;
}

export function buildLayout(paintings: MuseumPainting[]): MuseumLayout {
  const sizes = paintings.map((p) => {
    const { w, h } = canvasSize(p);
    return { p, canvasW: w, canvasH: h, frameW: w + 2 * FRAME_BORDER, frameH: h + 2 * FRAME_BORDER };
  });

  const n = sizes.length;
  const width = ROOM_WIDTH;
  const farUsable = width - 2 * CORNER_CLEAR;

  // Walking order: right wall → far wall → left wall. Fill the far wall with
  // the middle of the sequence, as much of it as physically fits.
  let rightCount = Math.ceil(n * 0.375);
  let farCount = n - 2 * rightCount + (n % 2 === 0 ? 0 : 1);
  const fits = (count: number, start: number) => {
    const run = sizes.slice(start, start + count).reduce((acc, s) => acc + slotRun(s.frameW), 0);
    return run <= farUsable;
  };
  while (farCount > 0 && !fits(farCount, rightCount)) {
    farCount -= 1;
    if ((n - farCount) % 2 === 1) {
      rightCount = Math.ceil((n - farCount) / 2);
    } else {
      rightCount = (n - farCount) / 2;
    }
  }
  const right = sizes.slice(0, rightCount);
  const far = sizes.slice(rightCount, rightCount + farCount);
  const left = sizes.slice(rightCount + farCount);

  const runOf = (group: typeof sizes) => group.reduce((acc, s) => acc + slotRun(s.frameW), 0);
  const sideRun = Math.max(runOf(right), runOf(left));
  // Entry breathing room at +z, clearance before the far wall at -z.
  const length = Math.max(14, sideRun + 2 * CORNER_CLEAR + 3);

  const placements: Placement[] = [];

  // Lay a group along a wall, centered on its usable span. `place` maps the
  // 1-D offset (from the group's start) to a world position + orientation.
  const layRun = (
    group: typeof sizes,
    wallRun: number,
    place: (s: (typeof sizes)[number], centerOffset: number) => Placement,
  ) => {
    const total = runOf(group);
    let cursor = (wallRun - total) / 2;
    for (const s of group) {
      const run = slotRun(s.frameW);
      placements.push(place(s, cursor + run / 2));
      cursor += run;
    }
  };

  const sideUsable = length - 2 * CORNER_CLEAR;
  const halfW = width / 2;
  const halfL = length / 2;

  // Right wall (x = +halfW), walked from entry (+z) toward the far wall (-z).
  layRun(right, sideUsable, (s, off) => ({
    painting: s.p,
    wall: "right",
    position: [halfW, hangY(s.frameH), halfL - CORNER_CLEAR - off],
    rotationY: -Math.PI / 2,
    normal: [-1, 0, 0],
    canvasW: s.canvasW,
    canvasH: s.canvasH,
    frameW: s.frameW,
    frameH: s.frameH,
  }));

  // Far wall (z = -halfL), walked from right (+x) to left (-x).
  layRun(far, farUsable, (s, off) => ({
    painting: s.p,
    wall: "far",
    position: [halfW - CORNER_CLEAR - off, hangY(s.frameH), -halfL],
    rotationY: 0,
    normal: [0, 0, 1],
    canvasW: s.canvasW,
    canvasH: s.canvasH,
    frameW: s.frameW,
    frameH: s.frameH,
  }));

  // Left wall (x = -halfW), walked from the far wall (-z) back toward entry.
  layRun(left, sideUsable, (s, off) => ({
    painting: s.p,
    wall: "left",
    position: [-halfW, hangY(s.frameH), -halfL + CORNER_CLEAR + off],
    rotationY: Math.PI / 2,
    normal: [1, 0, 0],
    canvasW: s.canvasW,
    canvasH: s.canvasH,
    frameW: s.frameW,
    frameH: s.frameH,
  }));

  // A bench every ~7 m down the centerline, oriented along the hall.
  const benches: Bench[] = [];
  const benchCount = Math.max(1, Math.floor(length / 7));
  for (let i = 0; i < benchCount; i++) {
    const z = -halfL + (length * (i + 1)) / (benchCount + 1);
    benches.push({ position: [0, 0, z], rotationY: Math.PI / 2 });
  }

  return {
    width,
    length,
    placements,
    benches,
    spawn: [0, EYE_HEIGHT, halfL - 1.6],
  };
}

/**
 * Head-on camera distance that frames the whole canvas with some air around
 * it, for the inspect fly-to.
 */
export function framingDistance(
  canvasW: number,
  canvasH: number,
  fovDeg: number,
  aspect: number,
): number {
  const fov = (fovDeg * Math.PI) / 180;
  const fitH = (canvasH / 2 / Math.tan(fov / 2)) * 1.35;
  const hFov = 2 * Math.atan(Math.tan(fov / 2) * aspect);
  const fitW = (canvasW / 2 / Math.tan(hFov / 2)) * 1.35;
  return Math.max(fitH, fitW, 0.9);
}
