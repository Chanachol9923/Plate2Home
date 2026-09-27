/**
 * In-browser plate OCR with Tesseract.js (Thai LSTM model, Apache-2.0), running in its own Web
 * Worker. Everything is self-hosted under /tesseract and loaded only when the found flow needs it.
 *
 *  - findPlates(photo):   plates in a whole photo (text spotting + verified stroke patterns)
 *  - readPlate(crop):     reads the plate number and province from one crop
 *
 * This is the fallback recognizer of spec §7.1 until a trained plate model exists (Phase 6).
 * Results are always prefilled for the user to confirm, never trusted blindly.
 */
import type Tesseract from 'tesseract.js';
import { plateCandidates } from '@/lib/ocr/candidates';
import {
  findPlateRegions,
  growPlateBox,
  interpretPlateLines,
  iou,
  tightenCrop,
  type OcrLine,
  type OcrWordLine,
  type PlateReading,
} from '@/lib/ocr/interpret';
import { PLATE_CONSONANTS } from '@/lib/plate/chars';
import { snapProvince } from '@/lib/plate/provinces';
import type { PlateType } from '@/lib/plate/types';
import type { LoadedPhoto, Rect } from './image';

/** On by default; NEXT_PUBLIC_FEATURE_OCR=false turns it off (manual entry always works). */
export const OCR_ENABLED = process.env.NEXT_PUBLIC_FEATURE_OCR !== 'false';

const ASSETS = '/tesseract';
const WHITELIST = `${PLATE_CONSONANTS.join('')}0123456789 `;

type TWorker = Tesseract.Worker;
let workerPromise: Promise<TWorker> | null = null;
let queue: Promise<unknown> = Promise.resolve();
const loadListeners = new Set<(progress: number) => void>();

/** Subscribe to first-load progress (downloading the engine and the Thai model). */
export function onOcrLoading(listener: (progress: number) => void): () => void {
  loadListeners.add(listener);
  return () => loadListeners.delete(listener);
}

function worker(): Promise<TWorker> {
  workerPromise ??= import('tesseract.js')
    .then((T) =>
      T.createWorker('tha', T.OEM.LSTM_ONLY, {
        workerPath: `${ASSETS}/worker.min.js`,
        corePath: `${ASSETS}/core`,
        langPath: `${ASSETS}/lang`,
        gzip: true,
        workerBlobURL: false,
        logger: (m: { status: string; progress: number }) => {
          if (m.status !== 'recognizing text') loadListeners.forEach((l) => l(m.progress));
        },
      }),
    )
    .catch((err: unknown) => {
      workerPromise = null;
      throw err;
    });
  return workerPromise;
}

/** One job at a time: parameters are per worker, so jobs must not interleave. */
function exclusive<T>(job: (w: TWorker) => Promise<T>): Promise<T> {
  const run = queue.then(async () => job(await worker()));
  queue = run.catch(() => undefined);
  return run;
}

/**
 * Plate borders are long straight dark lines; OCR reads them as letters ("ป") and they merge
 * the number and province rows into one line. An unbroken dark run longer than any character
 * stroke (35% of the width across, 55% of the height down) is a border, so it is painted
 * white. Runs, not totals, so it also works when the crop has margin around the plate.
 * Works on RGBA grey pixels.
 */
function eraseLongLines(d: Uint8ClampedArray, width: number, height: number) {
  const dark = (x: number, y: number) => d[(y * width + x) * 4]! < 110;
  const paint = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    d[i] = d[i + 1] = d[i + 2] = 255;
  };
  const runs: [number, number, number, boolean][] = []; // [fixed, from, to, isRow]
  for (let y = 0; y < height; y++) {
    for (let x = 0, from = -1; x <= width; x++) {
      if (x < width && dark(x, y)) {
        if (from < 0) from = x;
      } else if (from >= 0) {
        if (x - from > width * 0.35) runs.push([y, from, x, true]);
        from = -1;
      }
    }
  }
  for (let x = 0; x < width; x++) {
    for (let y = 0, from = -1; y <= height; y++) {
      if (y < height && dark(x, y)) {
        if (from < 0) from = y;
      } else if (from >= 0) {
        if (y - from > height * 0.55) runs.push([x, from, y, false]);
        from = -1;
      }
    }
  }
  for (const [fixed, from, to, isRow] of runs) {
    for (let v = from; v < to; v++) {
      if (isRow) paint(v, fixed);
      else paint(fixed, v);
    }
  }
}

/** Grey, contrast-stretched copy, scaled so text is a comfortable size for the OCR model. */
function prepare(
  source: CanvasImageSource,
  width: number,
  height: number,
  minHeight: number,
  maxWidth: number,
  removeLines = false,
) {
  const scale = Math.min(maxWidth / width, Math.max(1, minHeight / height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  const grey = new Uint8ClampedArray(d.length / 4);
  const hist = new Uint32Array(256);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    const g = (d[i]! * 299 + d[i + 1]! * 587 + d[i + 2]! * 114) / 1000;
    grey[j] = g;
    hist[grey[j]!]!++;
  }
  // Stretch between the 2nd and 98th percentiles: muddy, low-contrast plates read better.
  const total = grey.length;
  let lo = 0;
  let hi = 255;
  for (let acc = 0; lo < 255 && (acc += hist[lo]!) < total * 0.02; lo++);
  for (let acc = 0; hi > 0 && (acc += hist[hi]!) < total * 0.02; hi--);
  const range = Math.max(1, hi - lo);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    const v = Math.max(0, Math.min(255, ((grey[j]! - lo) * 255) / range));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  if (removeLines) eraseLongLines(d, canvas.width, canvas.height);
  ctx.putImageData(img, 0, 0);
  return { canvas, scale };
}

function linesOf(page: Tesseract.Page): OcrLine[] {
  return (page.blocks ?? []).flatMap((b) =>
    b.paragraphs.flatMap((p) =>
      p.lines.map((l) => ({
        text: l.text,
        confidence: l.confidence,
        bbox: l.bbox,
        symbols: l.words.flatMap((w) =>
          w.symbols.map((s) => ({ text: s.text, confidence: s.confidence })),
        ),
      })),
    ),
  );
}

function wordLinesOf(page: Tesseract.Page): OcrWordLine[] {
  return (page.blocks ?? []).flatMap((b) =>
    b.paragraphs.flatMap((p) =>
      p.lines.map((l) => ({
        words: l.words.map((w) => ({ text: w.text, confidence: w.confidence, bbox: w.bbox })),
      })),
    ),
  );
}

/** Read one plate crop: plate number (with low-confidence characters as `?`) and province. */
export async function readPlate(crop: Blob, type: PlateType): Promise<PlateReading | null> {
  const bitmap = await createImageBitmap(crop);
  try {
    return await readSource(bitmap, bitmap.width, bitmap.height, type);
  } finally {
    bitmap.close();
  }
}

async function readSource(
  source: CanvasImageSource,
  width: number,
  height: number,
  type: PlateType,
): Promise<PlateReading | null> {
  const { canvas } = prepare(source, width, height, 320, 1400, true);

  return exclusive(async (w) => {
    const T = await import('tesseract.js');
    // Page layout analysis handles plate borders better than "single block" (which reads the
    // borders as letters); fall back to single block if it finds nothing plate-like.
    let reading: PlateReading | null = null;
    for (const psm of [T.PSM.AUTO, T.PSM.SINGLE_BLOCK]) {
      await w.setParameters({ tessedit_pageseg_mode: psm, tessedit_char_whitelist: '' });
      const pass = await w.recognize(canvas, {}, { blocks: true, text: true });
      reading = interpretPlateLines(linesOf(pass.data), type);
      if (reading) break;
    }
    // Where the whole plate is, for automatic cropping (from the first pass's number line).
    let plateBox: PlateReading['plateBox'] = null;
    if (reading?.lineBox) {
      const b = growPlateBox(reading.lineBox, canvas.width, canvas.height);
      plateBox = {
        x0: b.x0 / canvas.width,
        y0: b.y0 / canvas.height,
        x1: b.x1 / canvas.width,
        y1: b.y1 / canvas.height,
      };
    }

    // Second, focused pass on the plate-number line with plate characters only.
    if (reading?.lineBox && type !== 'motorcycle') {
      const b = reading.lineBox;
      const pad = (b.y1 - b.y0) * 0.25;
      await w.setParameters({
        tessedit_pageseg_mode: T.PSM.SINGLE_LINE,
        tessedit_char_whitelist: WHITELIST,
      });
      const second = await w.recognize(
        canvas,
        {
          rectangle: {
            left: Math.max(0, Math.round(b.x0 - pad)),
            top: Math.max(0, Math.round(b.y0 - pad)),
            width: Math.min(canvas.width, Math.round(b.x1 - b.x0 + pad * 2)),
            height: Math.min(canvas.height, Math.round(b.y1 - b.y0 + pad * 2)),
          },
        },
        { blocks: true, text: true },
      );
      const refined = interpretPlateLines(linesOf(second.data), type);
      if (refined && refined.confidence >= reading.confidence) {
        reading = { ...refined, provinceCode: reading.provinceCode };
      }
    }
    // Province still unknown: read the strip below the number line on its own.
    if (reading?.lineBox && !reading.provinceCode && type !== 'motorcycle') {
      const top = Math.round(reading.lineBox.y1);
      if (canvas.height - top > canvas.height * 0.12) {
        await w.setParameters({
          tessedit_pageseg_mode: T.PSM.SINGLE_LINE,
          tessedit_char_whitelist: '',
        });
        const below = await w.recognize(
          canvas,
          { rectangle: { left: 0, top, width: canvas.width, height: canvas.height - top } },
          { text: true },
        );
        const snap = snapProvince(below.data.text);
        if (snap) reading = { ...reading, provinceCode: snap.code };
      }
    }
    return reading && { ...reading, plateBox };
  });
}

/** Text spotting works best on a photo about this wide (bigger text reads worse). */
const SPOT_WIDTH = 1280;

export interface FoundPlate {
  /** The plate in photo pixels. */
  rect: Rect;
  /** Already read while verifying it (candidates found without text spotting). */
  reading: PlateReading | null;
}

type Corners = { x0: number; y0: number; x1: number; y1: number };
const toBox = (r: Rect): Corners => ({ x0: r.x, y0: r.y, x1: r.x + r.width, y1: r.y + r.height });

/**
 * Plates in a whole photo, in photo pixel coordinates. Two passes:
 *  1. text spotting over the photo (finds plates whose text is big enough to read there);
 *  2. plate-like stroke patterns (lib/ocr/candidates), each cut out at full resolution and
 *     kept only if it reads as a plate. This catches small plates in large photos.
 */
export async function findPlates(photo: LoadedPhoto): Promise<FoundPlate[]> {
  const { canvas, scale } = prepare(photo.canvas, photo.width, photo.height, 0, SPOT_WIDTH);
  const spotted = await exclusive(async (w) => {
    const T = await import('tesseract.js');
    await w.setParameters({
      tessedit_pageseg_mode: T.PSM.AUTO,
      tessedit_char_whitelist: '',
    });
    const result = await w.recognize(canvas, {}, { blocks: true });
    return findPlateRegions(wordLinesOf(result.data), canvas.width, canvas.height).map((r) => ({
      x: r.x0 / scale,
      y: r.y0 / scale,
      width: (r.x1 - r.x0) / scale,
      height: (r.y1 - r.y0) / scale,
    }));
  });
  const found: FoundPlate[] = spotted.map((rect) => ({ rect, reading: null }));

  for (const rect of candidateRects(photo)) {
    if (found.some((f) => overlaps(toBox(f.rect), toBox(rect)))) continue;
    const region = document.createElement('canvas');
    region.width = Math.max(1, Math.round(rect.width));
    region.height = Math.max(1, Math.round(rect.height));
    region
      .getContext('2d')!
      .drawImage(
        photo.canvas,
        rect.x,
        rect.y,
        rect.width,
        rect.height,
        0,
        0,
        region.width,
        region.height,
      );
    const reading = await readSource(region, region.width, region.height, 'car');
    // Stroke patterns match lots of things (signs, grilles): keep only confident plate readings.
    if (!reading || reading.confidence < CANDIDATE_MIN_CONFIDENCE) continue;
    const plate = generousPlateRect(rect, reading.plateBox);
    if (found.some((f) => overlaps(toBox(f.rect), toBox(plate)))) continue;
    found.push({ rect: plate, reading });
  }
  return found;
}

/** Same plate: boxes overlap a lot, or one sits mostly inside the other. */
function overlaps(a: Corners, b: Corners): boolean {
  if (iou(a, b) > 0.2) return true;
  const inter =
    Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) *
    Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  const smaller = Math.min((a.x1 - a.x0) * (a.y1 - a.y0), (b.x1 - b.x0) * (b.y1 - b.y0));
  return inter > smaller * 0.5;
}

const CANDIDATE_WIDTH = 960;
const CANDIDATE_MIN_CONFIDENCE = 0.6;

/**
 * Where to cut a verified candidate: around the plate the reading located, with wide margins
 * (a crop that is too loose is harmless; one that cuts into the plate is not), and never
 * outside the candidate region.
 */
function generousPlateRect(region: Rect, plateBox: PlateReading['plateBox']): Rect {
  const plate = plateBox && tightenCrop(region, plateBox, 1);
  if (!plate) return region;
  const x0 = Math.max(region.x, plate.x - plate.width * 0.2);
  const y0 = Math.max(region.y, plate.y - plate.height * 0.3);
  const x1 = Math.min(region.x + region.width, plate.x + plate.width * 1.2);
  const y1 = Math.min(region.y + region.height, plate.y + plate.height * 1.3);
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/** Plate-like stroke patterns, grown to a generous plate-sized box, in photo pixels. */
function candidateRects(photo: LoadedPhoto): Rect[] {
  const scale = Math.min(1, CANDIDATE_WIDTH / photo.width);
  const w = Math.max(1, Math.round(photo.width * scale));
  const h = Math.max(1, Math.round(photo.height * scale));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(photo.canvas, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  const grey = new Uint8Array(w * h);
  for (let i = 0, j = 0; j < grey.length; i += 4, j++) {
    grey[j] = (d[i]! * 299 + d[i + 1]! * 587 + d[i + 2]! * 114) / 1000;
  }
  return plateCandidates(grey, w, h).map((b) => {
    // The blob may be just the number line: leave room for the whole plate around it.
    const g = growPlateBox(b, w, h);
    const padX = (g.x1 - g.x0) * 0.15;
    const padY = (g.y1 - g.y0) * 0.2;
    const x0 = Math.max(0, g.x0 - padX);
    const y0 = Math.max(0, g.y0 - padY);
    const x1 = Math.min(w, g.x1 + padX);
    const y1 = Math.min(h, g.y1 + padY);
    return { x: x0 / scale, y: y0 / scale, width: (x1 - x0) / scale, height: (y1 - y0) / scale };
  });
}
