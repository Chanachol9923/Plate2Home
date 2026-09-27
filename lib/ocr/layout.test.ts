import { describe, expect, it } from 'vitest';
import type { Box } from './interpret';
import { canny, dedupe, downscale, findPlatesInLayout } from './layout';

type RGB = readonly [number, number, number];

/** A small RGBA canvas stand-in: a patterned "floor" plus drawn rectangles. */
function scene(w: number, h: number) {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Teal tiles with lighter diagonal stripes, like a patterned floor.
      const stripe = (x + y) % 40 < 8;
      const c: RGB = stripe ? [150, 200, 190] : [95, 160, 150];
      px.set([...c, 255], (y * w + x) * 4);
    }
  }
  const rect = (x0: number, y0: number, x1: number, y1: number, c: RGB) => {
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) px.set([...c, 255], (y * w + x) * 4);
  };
  /** A plate: paint, a number line of bold "characters" and a smaller province line. */
  const plate = (x: number, y: number, paint: RGB = [235, 235, 230], withText = true) => {
    rect(x, y, x + 200, y + 90, paint);
    if (!withText) return;
    // Letters as 4 px outlines, 5 px apart, with a wider gap between series and number.
    const letter = (lx: number, ly: number, lw: number, lh: number, c: RGB) => {
      rect(lx, ly, lx + lw, ly + 4, c);
      rect(lx, ly + lh - 4, lx + lw, ly + lh, c);
      rect(lx, ly, lx + 4, ly + lh, c);
      rect(lx + lw - 4, ly, lx + lw, ly + lh, c);
    };
    for (let k = 0; k < 7; k++) {
      if (k === 3) continue; // gap between the series and the number
      letter(x + 16 + k * 24, y + 12, 19, 36, [20, 20, 20]);
    }
    for (let k = 0; k < 12; k++)
      rect(x + 40 + k * 10, y + 60, x + 40 + k * 10 + 6, y + 74, [30, 30, 30]);
  };
  return { px, plate, rect };
}

const covers = (b: Box, x0: number, y0: number, x1: number, y1: number) =>
  b.x0 <= x0 + 6 && b.y0 <= y0 + 6 && b.x1 >= x1 - 6 && b.y1 >= y1 - 6;

describe('findPlatesInLayout', () => {
  it('finds one plate on a patterned floor, outlining its paint', () => {
    const s = scene(600, 400);
    s.plate(200, 150);
    const found = findPlatesInLayout(s.px, 600, 400);
    expect(found).toHaveLength(1);
    expect(covers(found[0]!, 200, 150, 400, 240)).toBe(true);
    expect(found[0]!.x1 - found[0]!.x0).toBeLessThan(230); // not leaking into the floor
  });

  it('keeps plates lying close together apart', () => {
    const s = scene(700, 400);
    s.plate(100, 150);
    s.plate(312, 150); // 12 px of floor between them
    const found = findPlatesInLayout(s.px, 700, 400);
    expect(found).toHaveLength(2);
    const [a, b] = [...found].sort((p, q) => p.x0 - q.x0);
    expect(covers(a!, 100, 150, 300, 240)).toBe(true);
    expect(covers(b!, 312, 150, 512, 240)).toBe(true);
  });

  it('finds a yellow plate', () => {
    const s = scene(600, 400);
    s.plate(200, 150, [225, 190, 40]);
    expect(findPlatesInLayout(s.px, 600, 400)).toHaveLength(1);
  });

  it('ignores bright rectangles without text (an empty plate frame) and tiny images', () => {
    const s = scene(600, 400);
    s.plate(200, 150, [235, 235, 230], false);
    expect(findPlatesInLayout(s.px, 600, 400)).toEqual([]);
    expect(findPlatesInLayout(new Uint8ClampedArray(16 * 16 * 4), 16, 16)).toEqual([]);
  });
});

describe('canny', () => {
  it('marks the outline of a bright square, not its inside', () => {
    const w = 40;
    const grey = new Uint8Array(w * w);
    for (let y = 10; y < 30; y++) for (let x = 10; x < 30; x++) grey[y * w + x] = 220;
    const e = canny(grey, w, w, 60, 140);
    expect(e[20 * w + 10] || e[20 * w + 9]).toBe(1);
    expect(e[20 * w + 20]).toBe(0);
  });
});

describe('dedupe', () => {
  it('drops a box that sits inside a bigger one', () => {
    const big = { x0: 0, y0: 0, x1: 100, y1: 50 };
    const part = { x0: 10, y0: 10, x1: 40, y1: 40 };
    const other = { x0: 200, y0: 0, x1: 300, y1: 50 };
    expect(dedupe([part, big, other])).toEqual([big, other]);
  });
});

describe('downscale', () => {
  it('averages areas and never upscales', () => {
    const px = new Uint8ClampedArray([0, 0, 0, 255, 200, 100, 50, 255]); // 2×1
    const half = downscale(px, 2, 1, 1);
    expect(half).toMatchObject({ width: 1, height: 1, scale: 0.5 });
    expect([...half.data]).toEqual([100, 50, 25, 255]);
    expect(downscale(px, 2, 1, 10)).toMatchObject({ width: 2, scale: 1 });
  });
});
