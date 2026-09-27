/**
 * Plates in a photo without OCR, tuned for real finder photos: one plate, or many plates laid
 * out on a floor (D-072). Pure, so it is unit-tested and runs in the browser on raw pixels.
 *
 *  1. Dark text on bright paint: grey "black-hat" (closing minus image) against the local paint
 *     brightness, so yellow plates and dim corners work too.
 *  2. Words: text strokes joined horizontally. Each word seeds a flood fill over its plate's
 *     paint colour (text is passable, strong edges such as plate borders are not), so the
 *     painted area gives the plate outline, and words on one plate end up in one region.
 *  3. A region counts as a plate when it is plate-shaped, mostly paint, and has more text below
 *     the seed line (the province line).
 *
 * All sizes are for an image about WORK_WIDTH pixels wide; callers scale the photo to that.
 */
import type { Box } from './interpret';

export const WORK_WIDTH = 1000;

// ------------------------------------------------------------------ small image operations

/** Sliding max/min over a line with a monotonic deque (O(n)), radius `r` each side. */
function slide(
  src: ArrayLike<number>,
  dst: { [i: number]: number },
  n: number,
  offset: number,
  stride: number,
  r: number,
  isMax: boolean,
  q: Int32Array,
) {
  let head = 0;
  let tail = 0;
  const at = (i: number) => src[offset + i * stride]!;
  const better = (a: number, b: number) => (isMax ? a >= b : a <= b);
  let next = 0;
  for (let i = 0; i < n; i++) {
    const hi = Math.min(n - 1, i + r);
    while (next <= hi) {
      const v = at(next);
      while (tail > head && better(v, at(q[tail - 1]!))) tail--;
      q[tail++] = next++;
    }
    while (q[head]! < i - r) head++;
    dst[offset + i * stride] = at(q[head]!);
  }
}

/** Grey-level dilation (max) or erosion (min) with a (2ry+1)×(2rx+1) rectangle. */
function morph(src: Uint8Array, w: number, h: number, rx: number, ry: number, isMax: boolean) {
  const tmp = new Uint8Array(w * h);
  const out = new Uint8Array(w * h);
  const q = new Int32Array(Math.max(w, h));
  for (let y = 0; y < h; y++) slide(src, tmp, w, y * w, 1, rx, isMax, q);
  for (let x = 0; x < w; x++) slide(tmp, out, h, x, w, ry, isMax, q);
  return out;
}

const close = (src: Uint8Array, w: number, h: number, rx: number, ry: number) =>
  morph(morph(src, w, h, rx, ry, true), w, h, rx, ry, false);

interface Component {
  x0: number;
  y0: number;
  x1: number; // inclusive
  y1: number;
  area: number;
  label: number;
}

/** 8-connected components of a 0/1 mask; `labels` gets 1-based ids. */
function components(mask: Uint8Array, w: number, h: number, labels?: Int32Array): Component[] {
  const lab = labels ?? new Int32Array(w * h);
  const stack = new Int32Array(w * h);
  const out: Component[] = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || lab[start]) continue;
    const label = out.length + 1;
    let top = 0;
    stack[top++] = start;
    lab[start] = label;
    const c: Component = { x0: w, y0: h, x1: 0, y1: 0, area: 0, label };
    while (top > 0) {
      const i = stack[--top]!;
      const x = i % w;
      const y = (i - x) / w;
      c.area++;
      if (x < c.x0) c.x0 = x;
      if (x > c.x1) c.x1 = x;
      if (y < c.y0) c.y0 = y;
      if (y > c.y1) c.y1 = y;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          const j = yy * w + xx;
          if (mask[j] && !lab[j]) {
            lab[j] = label;
            stack[top++] = j;
          }
        }
      }
    }
    out.push(c);
  }
  return out;
}

/** Canny edges (L1 gradient, like OpenCV's default), as a 0/1 mask. */
export function canny(grey: Uint8Array, w: number, h: number, lo: number, hi: number) {
  const mag = new Float32Array(w * h);
  const dir = new Uint8Array(w * h); // 0: horizontal edge normal ... 3
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const p = (dx: number, dy: number) => grey[i + dy * w + dx]!;
      const gx = p(1, -1) + 2 * p(1, 0) + p(1, 1) - p(-1, -1) - 2 * p(-1, 0) - p(-1, 1);
      const gy = p(-1, 1) + 2 * p(0, 1) + p(1, 1) - p(-1, -1) - 2 * p(0, -1) - p(1, -1);
      mag[i] = Math.abs(gx) + Math.abs(gy);
      const ax = Math.abs(gx);
      const ay = Math.abs(gy);
      // tan(22.5°) ≈ 0.4142
      if (ay <= ax * 0.4142) dir[i] = 0;
      else if (ax <= ay * 0.4142) dir[i] = 2;
      else dir[i] = gx * gy > 0 ? 1 : 3;
    }
  }
  const strong = new Uint8Array(w * h);
  const weak = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const m = mag[i]!;
      if (m <= lo) continue;
      let a = 0;
      let b = 0;
      switch (dir[i]) {
        case 0:
          a = mag[i - 1]!;
          b = mag[i + 1]!;
          break;
        case 2:
          a = mag[i - w]!;
          b = mag[i + w]!;
          break;
        case 1:
          a = mag[i - w - 1]!;
          b = mag[i + w + 1]!;
          break;
        default:
          a = mag[i - w + 1]!;
          b = mag[i + w - 1]!;
      }
      if (m < a || m < b) continue;
      if (m > hi) strong[i] = 1;
      else weak[i] = 1;
    }
  }
  // Hysteresis: weak edges connected to strong ones are kept.
  const stack: number[] = [];
  for (let i = 0; i < strong.length; i++) if (strong[i]) stack.push(i);
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % w;
    const y = (i - x) / w;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const j = yy * w + xx;
        if (weak[j] && !strong[j]) {
          strong[j] = 1;
          stack.push(j);
        }
      }
    }
  }
  return strong;
}

const median = (values: number[]) => {
  values.sort((a, b) => a - b);
  return values[values.length >> 1] ?? 0;
};

/**
 * Area-average downscale of RGBA pixels to `nw` wide (the same result in every browser and in
 * tests, unlike canvas smoothing). Never upscales.
 */
export function downscale(
  rgba: ArrayLike<number>,
  w: number,
  h: number,
  nw: number,
): { data: Uint8ClampedArray; width: number; height: number; scale: number } {
  const scale = Math.min(1, nw / w);
  const ow = Math.max(1, Math.round(w * scale));
  const oh = Math.max(1, Math.round(h * scale));
  const out = new Uint8ClampedArray(ow * oh * 4);
  const fx = w / ow;
  const fy = h / oh;
  for (let oy = 0; oy < oh; oy++) {
    const sy0 = Math.floor(oy * fy);
    const sy1 = Math.max(sy0 + 1, Math.min(h, Math.floor((oy + 1) * fy)));
    for (let ox = 0; ox < ow; ox++) {
      const sx0 = Math.floor(ox * fx);
      const sx1 = Math.max(sx0 + 1, Math.min(w, Math.floor((ox + 1) * fx)));
      let r = 0;
      let g = 0;
      let b = 0;
      for (let y = sy0; y < sy1; y++) {
        for (let x = sx0; x < sx1; x++) {
          const i = (y * w + x) * 4;
          r += rgba[i]!;
          g += rgba[i + 1]!;
          b += rgba[i + 2]!;
        }
      }
      const k = (sy1 - sy0) * (sx1 - sx0);
      const o = (oy * ow + ox) * 4;
      out[o] = r / k;
      out[o + 1] = g / k;
      out[o + 2] = b / k;
      out[o + 3] = 255;
    }
  }
  return { data: out, width: ow, height: oh, scale };
}

// ------------------------------------------------------------------------------- detector

interface Word {
  x0: number;
  y0: number;
  x1: number; // exclusive
  y1: number;
}

/**
 * Plate boxes in an RGBA image (about WORK_WIDTH wide), best candidates first.
 * Boxes are in the image's pixel coordinates.
 */
export function findPlatesInLayout(rgba: ArrayLike<number>, w: number, h: number): Box[] {
  if (w < 32 || h < 32) return [];
  const n = w * h;

  // Grey, closing (paint brightness with text filled in), black-hat.
  const grey = new Uint8Array(n);
  for (let i = 0, j = 0; j < n; i += 4, j++) {
    grey[j] = Math.round(0.299 * rgba[i]! + 0.587 * rgba[i + 1]! + 0.114 * rgba[i + 2]!);
  }
  const closed = close(grey, w, h, 10, 10);
  const text = new Uint8Array(n);
  const loose = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const bh = closed[i]! - grey[i]!;
    if (bh > 50 && bh > 0.5 * closed[i]!) text[i] = 1;
    if (bh > 25 && bh > 0.22 * closed[i]!) loose[i] = 1;
  }

  // Drop specks, long thin lines (borders, frames) and big blobs from the text mask.
  const labels = new Int32Array(n);
  const drop = new Set<number>();
  for (const c of components(text, w, h, labels)) {
    const cw = c.x1 - c.x0 + 1;
    const ch = c.y1 - c.y0 + 1;
    if (c.area < 6 || (ch <= 6 && cw > 25) || (cw <= 6 && ch > 60) || cw > 150 || ch > 90) {
      drop.add(c.label);
    }
  }
  const clean = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (text[i] && !drop.has(labels[i]!)) clean[i] = 1;

  // Words: close with a 3×7 rectangle.
  const wordMask = close(clean, w, h, 3, 1);
  const words: Word[] = components(wordMask, w, h)
    .map((c) => ({ x0: c.x0, y0: c.y0, x1: c.x1 + 1, y1: c.y1 + 1 }))
    .filter((c) => c.y1 - c.y0 >= 14 && c.y1 - c.y0 <= 90 && c.x1 - c.x0 >= 8);

  // Strong edges block the fill, except right around text (embossed letters cast edges too).
  const edges = canny(grey, w, h, 60, 140);
  const nearText = morph(clean, w, h, 3, 3, true);
  const barrier = new Uint8Array(n);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      // Edges thickened by one pixel up and left (a 2×2 dilation).
      const e =
        edges[i] ||
        (x > 0 && edges[i - 1]) ||
        (y > 0 && edges[i - w]) ||
        (x > 0 && y > 0 && edges[i - w - 1]);
      if (e && !nearText[i]) barrier[i] = 1;
    }
  }

  // Lightly blurred colour for the paint comparisons.
  const rgb = new Uint8Array(n * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        let wsum = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = Math.min(h - 1, Math.max(0, y + dy));
          for (let dx = -1; dx <= 1; dx++) {
            const xx = Math.min(w - 1, Math.max(0, x + dx));
            const k = (dx === 0 ? 2 : 1) * (dy === 0 ? 2 : 1);
            sum += rgba[(yy * w + xx) * 4 + c]! * k;
            wsum += k;
          }
        }
        rgb[(y * w + x) * 3 + c] = Math.round(sum / wsum);
      }
    }
  }

  const found: Box[] = [];
  const inside = (b: Box, x: number, y: number) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;
  const visited = new Int32Array(n); // fill id per pixel (reset by id, not by clearing)
  let fillId = 0;
  const queue = new Int32Array(n);

  for (const wd of [...words].sort((a, b) => b.y1 - b.y0 - (a.y1 - a.y0))) {
    const wh = wd.y1 - wd.y0;
    const cx = (wd.x0 + wd.x1) >> 1;
    const cy = (wd.y0 + wd.y1) >> 1;
    if (found.some((b) => inside(b, cx, cy))) continue;

    // Paint colour: median of non-text pixels inside the word box.
    const rs: number[] = [];
    const gs: number[] = [];
    const bs: number[] = [];
    for (let y = wd.y0; y < wd.y1; y++) {
      for (let x = wd.x0; x < wd.x1; x++) {
        const i = y * w + x;
        if (text[i]) continue;
        rs.push(rgb[i * 3]!);
        gs.push(rgb[i * 3 + 1]!);
        bs.push(rgb[i * 3 + 2]!);
      }
    }
    if (rs.length < 10) continue;
    const paint = [median(rs), median(gs), median(bs)] as const;
    if ((paint[0] + paint[1] + paint[2]) / 3 < 90) continue;

    // Seed: the non-text pixel in the word box closest to the paint colour.
    let seed = -1;
    let best = Infinity;
    for (let y = wd.y0; y < wd.y1; y++) {
      for (let x = wd.x0; x < wd.x1; x++) {
        const i = y * w + x;
        if (text[i] || barrier[i]) continue;
        const d =
          Math.abs(rgb[i * 3]! - paint[0]) +
          Math.abs(rgb[i * 3 + 1]! - paint[1]) +
          Math.abs(rgb[i * 3 + 2]! - paint[2]);
        if (d < best) {
          best = d;
          seed = i;
        }
      }
    }
    if (seed < 0) continue;

    // Window around the word; the fill never leaves it.
    const wx0 = Math.max(0, Math.floor(wd.x0 - 6 * wh));
    const wy0 = Math.max(0, Math.floor(wd.y0 - 2.5 * wh));
    const wx1 = Math.min(w, Math.floor(wd.x1 + 6 * wh));
    const wy1 = Math.min(h, Math.floor(wd.y1 + 3.5 * wh));
    const colour = (i: number, c: number) =>
      barrier[i] ? 0 : text[i] ? paint[c]! : rgb[i * 3 + c]!;
    const s0 = colour(seed, 0);
    const s1 = colour(seed, 1);
    const s2 = colour(seed, 2);

    for (const tol of [24, 36]) {
      fillId++;
      let head = 0;
      let tail = 0;
      queue[tail++] = seed;
      visited[seed] = fillId;
      let count = 0;
      let rx0 = w;
      let ry0 = h;
      let rx1 = 0;
      let ry1 = 0;
      while (head < tail) {
        const i = queue[head++]!;
        const x = i % w;
        const y = (i - x) / w;
        count++;
        if (x < rx0) rx0 = x;
        if (x > rx1) rx1 = x;
        if (y < ry0) ry0 = y;
        if (y > ry1) ry1 = y;
        const tryPush = (j: number, xx: number, yy: number) => {
          if (xx < wx0 || xx >= wx1 || yy < wy0 || yy >= wy1 || visited[j] === fillId) return;
          if (
            Math.abs(colour(j, 0) - s0) > tol ||
            Math.abs(colour(j, 1) - s1) > tol ||
            Math.abs(colour(j, 2) - s2) > tol
          ) {
            return;
          }
          visited[j] = fillId;
          queue[tail++] = j;
        };
        tryPush(i - 1, x - 1, y);
        tryPush(i + 1, x + 1, y);
        tryPush(i - w, x, y - 1);
        tryPush(i + w, x, y + 1);
      }
      const rw = rx1 - rx0;
      const rh = ry1 - ry0;
      const fill = count / Math.max(1, rw * rh);

      // Text below the seed line inside the region (the province line).
      const by0 = Math.floor(wd.y1 + 0.15 * wh);
      const bx0 = Math.floor(rx0 + 0.05 * rw);
      const bx1 = Math.floor(rx1 - 0.05 * rw);
      let below = false;
      if (ry1 - by0 >= 0.4 * wh && bx1 > bx0) {
        let dark = 0;
        for (let y = by0; y < ry1; y++) for (let x = bx0; x < bx1; x++) dark += loose[y * w + x]!;
        below = dark / ((ry1 - by0) * (bx1 - bx0)) >= 0.03;
      }
      const aspect = rw / Math.max(1, rh);
      if (
        rh >= 1.15 * wh &&
        rh <= 5 * wh &&
        aspect >= 1.2 &&
        aspect <= 4 &&
        fill > 0.4 &&
        rw >= wd.x1 - wd.x0 &&
        below
      ) {
        found.push({ x0: rx0, y0: ry0, x1: rx1 + 1, y1: ry1 + 1 });
        break;
      }
    }
  }
  return dedupe(found);
}

/** Drop boxes that mostly sit inside another (a partial fill of the same plate). */
export function dedupe(boxes: Box[]): Box[] {
  const area = (b: Box) => (b.x1 - b.x0) * (b.y1 - b.y0);
  const overlap = (a: Box, b: Box) =>
    Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) *
    Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  const sorted = [...boxes].sort((a, b) => area(b) - area(a));
  const out: Box[] = [];
  for (const b of sorted) {
    if (out.some((o) => overlap(o, b) > 0.5 * area(b))) continue;
    out.push(b);
  }
  return out;
}
