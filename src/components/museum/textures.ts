// Procedural PBR finishes for the museum, painted in code at load time —
// no downloaded assets, nothing to license. Each set is a tileable
// color / roughness / normal trio generated once per page and cached; the
// callers make as many THREE textures (with their own repeat) as they need.

import * as THREE from "three";

export interface PbrCanvases {
  color: HTMLCanvasElement;
  roughness: HTMLCanvasElement;
  normal: HTMLCanvasElement;
}

export interface PbrMaps {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
}

/* ---------------------------------------------------------------- helpers */

// mulberry32: tiny seeded RNG so the floor looks identical on every visit.
function makeRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

// Tileable value noise on a periodic lattice: sampling u ∈ [0, period)
// wraps seamlessly, so any texture built from it tiles.
function makeValueNoise(periodX: number, periodY: number, seed: number) {
  const rng = makeRng(seed);
  const lattice = new Float32Array(periodX * periodY);
  for (let i = 0; i < lattice.length; i++) {
    lattice[i] = rng();
  }
  const at = (x: number, y: number) =>
    lattice[((y % periodY) + periodY) % periodY * periodX + (((x % periodX) + periodX) % periodX)];
  return (u: number, v: number): number => {
    const x0 = Math.floor(u);
    const y0 = Math.floor(v);
    const fx = smooth(u - x0);
    const fy = smooth(v - y0);
    const a = at(x0, y0);
    const b = at(x0 + 1, y0);
    const c = at(x0, y0 + 1);
    const d = at(x0 + 1, y0 + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
}

function canvasFromPixels(size: number, fill: (px: Uint8ClampedArray) => void): HTMLCanvasElement {
  const el = document.createElement("canvas");
  el.width = size;
  el.height = size;
  const ctx = el.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  fill(img.data);
  ctx.putImageData(img, 0, 0);
  return el;
}

// Central-difference normal map from a wrapped height field.
function normalFromHeight(height: Float32Array, size: number, strength: number): HTMLCanvasElement {
  return canvasFromPixels(size, (px) => {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const xp = height[y * size + ((x + 1) % size)];
        const xm = height[y * size + ((x - 1 + size) % size)];
        const yp = height[((y + 1) % size) * size + x];
        const ym = height[((y - 1 + size) % size) * size + x];
        const nx = (xm - xp) * strength;
        const ny = (ym - yp) * strength;
        const inv = 1 / Math.sqrt(nx * nx + ny * ny + 1);
        const i = (y * size + x) * 4;
        px[i] = (nx * inv * 0.5 + 0.5) * 255;
        px[i + 1] = (ny * inv * 0.5 + 0.5) * 255;
        px[i + 2] = (inv * 0.5 + 0.5) * 255;
        px[i + 3] = 255;
      }
    }
  });
}

function grayCanvas(values: Float32Array, size: number): HTMLCanvasElement {
  return canvasFromPixels(size, (px) => {
    for (let i = 0; i < values.length; i++) {
      const v = Math.max(0, Math.min(1, values[i])) * 255;
      px[i * 4] = v;
      px[i * 4 + 1] = v;
      px[i * 4 + 2] = v;
      px[i * 4 + 3] = 255;
    }
  });
}

/* ------------------------------------------------------------- wood floor */

// One tile covers WOOD_TILE_M meters: 8 planks across, staggered end joints.
export const WOOD_TILE_M = 3;

let woodCache: PbrCanvases | null = null;

function buildWood(): PbrCanvases {
  const S = 1024;
  const COLS = 8; // planks per tile
  const COL_W = S / COLS;
  const JOINT = S / 2; // end-joint every 1.5 m
  const GAP = 1.6; // half-width of the seam, px
  const BEVEL = 5; // edge rolloff, px

  const rng = makeRng(20260702);
  const jointOffset = Array.from({ length: COLS }, () => Math.floor(rng() * JOINT));
  // Per-plank character; keyed (column, row parity) so the pattern tiles.
  const plank = Array.from({ length: COLS * 2 }, () => ({
    tone: (rng() - 0.5) * 0.22,
    warmth: (rng() - 0.5) * 0.1,
    phase: rng() * 64,
  }));
  const grain = makeValueNoise(192, 24, 7331); // elongated along the plank
  const fine = makeValueNoise(384, 96, 40021);

  const color = new Uint8ClampedArray(S * S * 4);
  const rough = new Float32Array(S * S);
  const height = new Float32Array(S * S);

  // walnut, dark enough to sit under the reflections
  const BASE = [82, 62, 44];
  const DARK = [38, 28, 20];

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const c = Math.floor(x / COL_W);
      const yy = y + jointOffset[c];
      const row = Math.floor(yy / JOINT);
      const p = plank[c * 2 + (row & 1)];

      // distance to the nearest seam (plank side or end joint)
      const dx = Math.min(x - c * COL_W, (c + 1) * COL_W - x);
      const dy = Math.min(yy - row * JOINT, (row + 1) * JOINT - yy);
      const edge = Math.min(dx, dy);

      const g =
        grain((x / S) * 192 + p.phase, (y / S) * 24 + p.phase) * 0.72 +
        fine((x / S) * 384 + p.phase, (y / S) * 96) * 0.28;

      const i = y * S + x;
      if (edge < GAP) {
        // the seam itself: near-black, rough, recessed
        color[i * 4] = DARK[0] * 0.6;
        color[i * 4 + 1] = DARK[1] * 0.6;
        color[i * 4 + 2] = DARK[2] * 0.6;
        rough[i] = 0.72;
        height[i] = 0;
      } else {
        const streak = Math.pow(g, 1.6); // bias toward darker grain lines
        const lum = 1 + p.tone - streak * 0.38;
        color[i * 4] = BASE[0] * lum * (1 + p.warmth) + DARK[0] * streak * 0.2;
        color[i * 4 + 1] = BASE[1] * lum + DARK[1] * streak * 0.2;
        color[i * 4 + 2] = BASE[2] * lum * (1 - p.warmth) + DARK[2] * streak * 0.2;
        rough[i] = 0.3 + p.tone * 0.25 + streak * 0.18;
        height[i] = Math.min(1, smooth(Math.min(edge - GAP, BEVEL) / BEVEL)) * (1 - g * 0.12);
      }
      color[i * 4 + 3] = 255;
    }
  }

  return {
    color: canvasFromPixels(S, (px) => px.set(color)),
    roughness: grayCanvas(rough, S),
    normal: normalFromHeight(height, S, 1.6),
  };
}

/* ------------------------------------------------------------ plaster wall */

export const PLASTER_TILE_M = 2.5;

let plasterCache: PbrCanvases | null = null;

function buildPlaster(): PbrCanvases {
  const S = 512;
  const mottle = makeValueNoise(6, 6, 90210); // broad tonal drift
  const noise = makeValueNoise(48, 48, 555);
  const speck = makeValueNoise(160, 160, 1234);

  const color = new Uint8ClampedArray(S * S * 4);
  const rough = new Float32Array(S * S);
  const height = new Float32Array(S * S);
  const BASE = [207, 196, 169]; // #cfc4a9

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S;
      const v = y / S;
      const m = mottle(u * 6, v * 6);
      const n = noise(u * 48, v * 48) * 0.6 + speck(u * 160, v * 160) * 0.4;
      const lum = 1 + (m - 0.5) * 0.045 + (n - 0.5) * 0.05;
      const i = y * S + x;
      color[i * 4] = BASE[0] * lum;
      color[i * 4 + 1] = BASE[1] * lum;
      color[i * 4 + 2] = BASE[2] * lum;
      color[i * 4 + 3] = 255;
      rough[i] = 0.88 + (n - 0.5) * 0.14;
      height[i] = n;
    }
  }

  return {
    color: canvasFromPixels(S, (px) => px.set(color)),
    roughness: grayCanvas(rough, S),
    normal: normalFromHeight(height, S, 0.55),
  };
}

/* ---------------------------------------------------------------- factory */

function toMaps(src: PbrCanvases, repeatX: number, repeatY: number, anisotropy: number): PbrMaps {
  const make = (el: HTMLCanvasElement, srgb: boolean) => {
    const tex = new THREE.CanvasTexture(el);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.anisotropy = anisotropy;
    if (srgb) {
      tex.colorSpace = THREE.SRGBColorSpace;
    }
    return tex;
  };
  return {
    map: make(src.color, true),
    roughnessMap: make(src.roughness, false),
    normalMap: make(src.normal, false),
  };
}

/** Floor maps sized so the plank tile spans WOOD_TILE_M meters. */
export function woodFloorMaps(widthM: number, lengthM: number, anisotropy = 16): PbrMaps {
  woodCache ??= buildWood();
  return toMaps(woodCache, widthM / WOOD_TILE_M, lengthM / WOOD_TILE_M, anisotropy);
}

/** Wall maps for a run of `runM` × `heightM` meters of plaster. */
export function plasterMaps(runM: number, heightM: number, anisotropy = 8): PbrMaps {
  plasterCache ??= buildPlaster();
  return toMaps(plasterCache, runM / PLASTER_TILE_M, heightM / PLASTER_TILE_M, anisotropy);
}

/* ------------------------------------------------------- frame drop shadow */

let frameShadowCache: THREE.CanvasTexture | null = null;

/**
 * Soft dark halo hung behind every frame — the drop shadow a spotlight from
 * above would cast, pre-drawn once instead of paid for with a shadow map per
 * light (12+ shadow samplers exceed WebGL's 16 texture units per shader).
 */
export function frameShadowTexture(): THREE.CanvasTexture {
  if (frameShadowCache) {
    return frameShadowCache;
  }
  const S = 256;
  const el = document.createElement("canvas");
  el.width = S;
  el.height = S;
  const ctx = el.getContext("2d")!;
  ctx.filter = "blur(18px)";
  ctx.fillStyle = "rgba(0, 0, 0, 1)";
  // nudged downward: the light hangs overhead
  ctx.beginPath();
  ctx.roundRect(34, 42, S - 68, S - 76, 18);
  ctx.fill();
  frameShadowCache = new THREE.CanvasTexture(el);
  return frameShadowCache;
}

export function disposeMaps(maps: PbrMaps): void {
  maps.map.dispose();
  maps.roughnessMap.dispose();
  maps.normalMap.dispose();
}
