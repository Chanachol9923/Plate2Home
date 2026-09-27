import { describe, expect, it } from 'vitest';
import { plateCandidates } from './candidates';

function image(w: number, h: number, bg = 120) {
  const px = new Uint8Array(w * h).fill(bg);
  const fill = (x0: number, y0: number, x1: number, y1: number, v: number) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) px[y * w + x] = v;
  };
  return { px, fill };
}

/** A light plate with a row of dark character strokes. */
function drawPlate(fill: ReturnType<typeof image>['fill'], x: number, y: number) {
  fill(x, y, x + 160, y + 60, 235);
  for (let s = x + 12; s < x + 148; s += 10) fill(s, y + 10, s + 4, y + 40, 25);
}

describe('plateCandidates', () => {
  it('finds a row of character strokes on a plate', () => {
    const { px, fill } = image(400, 300);
    drawPlate(fill, 100, 120);
    const found = plateCandidates(px, 400, 300);
    const hit = found.find((b) => b.x0 <= 180 && b.x1 >= 180 && b.y0 <= 145 && b.y1 >= 145);
    expect(hit).toBeDefined();
    expect(hit!.x1 - hit!.x0).toBeGreaterThan(100);
  });

  it('finds two plates in one photo', () => {
    const { px, fill } = image(800, 600);
    drawPlate(fill, 60, 80);
    drawPlate(fill, 500, 400);
    const found = plateCandidates(px, 800, 600);
    const covers = (cx: number, cy: number) =>
      found.some((b) => b.x0 <= cx && b.x1 >= cx && b.y0 <= cy && b.y1 >= cy);
    expect(covers(140, 105)).toBe(true);
    expect(covers(580, 425)).toBe(true);
  });

  it('ignores flat areas and lone lines', () => {
    const { px, fill } = image(400, 300);
    expect(plateCandidates(px, 400, 300)).toEqual([]);
    fill(200, 20, 204, 280, 10); // one tall pole
    expect(plateCandidates(px, 400, 300)).toEqual([]);
  });

  it('returns nothing for tiny images', () => {
    expect(plateCandidates(new Uint8Array(16), 4, 4)).toEqual([]);
  });
});
