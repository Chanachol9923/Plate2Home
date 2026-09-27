import { iou, type Box } from './interpret';

/**
 * Plate-like areas in a photo without OCR, for plates too small or blurry for text spotting to
 * see. A plate is a dense, wide band of short vertical strokes (its characters): vertical edges
 * are found, joined horizontally into blobs, and blobs with a text-line shape are kept. Many
 * false positives (signs, grilles) are expected; every candidate is verified by reading it.
 * Works on a grey image (one byte per pixel). Pure, so it is unit-tested.
 */
export function plateCandidates(grey: ArrayLike<number>, w: number, h: number, max = 6): Box[] {
  if (w < 8 || h < 8) return [];

  // 1. Vertical edges, thresholded relative to the image's own contrast.
  const grad = new Uint8Array(w * h);
  let sum = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const g = Math.abs(grey[i + 1]! - grey[i - 1]!);
      grad[i] = g;
      sum += g;
    }
  }
  const threshold = Math.max(40, (sum / (w * h)) * 3);
  const edge = new Uint8Array(w * h);
  for (let i = 0; i < edge.length; i++) edge[i] = grad[i]! > threshold ? 1 : 0;

  // 2. Close horizontally (dilate, then erode) so a line of characters becomes one blob.
  const r = Math.max(2, Math.round(w / 90));
  const dilated = new Uint8Array(w * h);
  const closed = new Uint8Array(w * h);
  const rowPrefix = new Int32Array(w + 1);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) rowPrefix[x + 1] = rowPrefix[x]! + edge[row + x]!;
    for (let x = 0; x < w; x++) {
      const a = Math.max(0, x - r);
      const b = Math.min(w, x + r + 1);
      dilated[row + x] = rowPrefix[b]! - rowPrefix[a]! > 0 ? 1 : 0;
    }
    for (let x = 0; x < w; x++) rowPrefix[x + 1] = rowPrefix[x]! + dilated[row + x]!;
    for (let x = 0; x < w; x++) {
      const a = Math.max(0, x - r);
      const b = Math.min(w, x + r + 1);
      closed[row + x] = rowPrefix[b]! - rowPrefix[a]! === b - a ? 1 : 0;
    }
  }

  // Integral image of edges, to measure stroke density inside any box.
  const integral = new Int32Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let run = 0;
    for (let x = 0; x < w; x++) {
      run += edge[y * w + x]!;
      integral[(y + 1) * (w + 1) + x + 1] = integral[y * (w + 1) + x + 1]! + run;
    }
  }
  const edgesIn = (b: Box) =>
    integral[(b.y1 + 1) * (w + 1) + b.x1 + 1]! -
    integral[b.y0 * (w + 1) + b.x1 + 1]! -
    integral[(b.y1 + 1) * (w + 1) + b.x0]! +
    integral[b.y0 * (w + 1) + b.x0]!;

  // 3. Connected blobs with a text-line shape.
  const seen = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  const scored: { box: Box; score: number }[] = [];
  for (let start = 0; start < closed.length; start++) {
    if (!closed[start] || seen[start]) continue;
    let top = 0;
    stack[top++] = start;
    seen[start] = 1;
    let count = 0;
    let x0 = w;
    let y0 = h;
    let x1 = 0;
    let y1 = 0;
    while (top > 0) {
      const i = stack[--top]!;
      const x = i % w;
      const y = (i - x) / w;
      count++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      const push = (j: number) => {
        if (closed[j] && !seen[j]) {
          seen[j] = 1;
          stack[top++] = j;
        }
      };
      if (x > 0) push(i - 1);
      if (x < w - 1) push(i + 1);
      if (y > 0) push(i - w);
      if (y < h - 1) push(i + w);
    }
    const bw = x1 - x0 + 1;
    const bh = y1 - y0 + 1;
    const aspect = bw / bh;
    if (bw < w * 0.04 || bw > w * 0.7) continue;
    if (bh < Math.max(6, h * 0.012) || bh > h * 0.35) continue;
    if (aspect < 1.3 || aspect > 9) continue;
    const box = { x0, y0, x1, y1 };
    const fill = count / (bw * bh);
    const density = edgesIn(box) / (bw * bh);
    if (fill < 0.4 || density < 0.08) continue;
    scored.push({ box, score: fill * density });
  }

  // 4. Best first, without near-duplicates.
  scored.sort((a, b) => b.score - a.score);
  const out: Box[] = [];
  for (const { box } of scored) {
    if (out.some((o) => iou(o, box) > 0.3)) continue;
    out.push(box);
    if (out.length >= max) break;
  }
  return out;
}
