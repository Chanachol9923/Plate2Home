/**
 * In-browser plate OCR with Tesseract.js (Thai LSTM model, Apache-2.0), running in its own Web
 * Worker. Everything is self-hosted under /tesseract and loaded only when the found flow needs it.
 *
 *  - findPlates(photo):   text-spotting pass over a whole photo → plate-shaped regions
 *  - readPlate(crop):     reads the plate number and province from one crop
 *
 * This is the fallback recognizer of spec §7.1 until a trained plate model exists (Phase 6).
 * Results are always prefilled for the user to confirm, never trusted blindly.
 */
import type Tesseract from 'tesseract.js';
import {
  findPlateRegions,
  interpretPlateLines,
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
 * the number and province rows into one line. Any row or column that is mostly dark is a
 * border (letter strokes never are), so it is painted white. Works on RGBA grey pixels.
 */
function eraseLongLines(d: Uint8ClampedArray, width: number, height: number) {
  const dark = (x: number, y: number) => d[(y * width + x) * 4]! < 110;
  const paint = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    d[i] = d[i + 1] = d[i + 2] = 255;
  };
  const cols: number[] = [];
  for (let x = 0; x < width; x++) {
    let n = 0;
    for (let y = 0; y < height; y++) if (dark(x, y)) n++;
    if (n > height * 0.6) cols.push(x);
  }
  const rows: number[] = [];
  for (let y = 0; y < height; y++) {
    let n = 0;
    for (let x = 0; x < width; x++) if (dark(x, y)) n++;
    if (n > width * 0.6) rows.push(y);
  }
  for (const x of cols) for (let y = 0; y < height; y++) paint(x, y);
  for (const y of rows) for (let x = 0; x < width; x++) paint(x, y);
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
  const { canvas } = prepare(bitmap, bitmap.width, bitmap.height, 320, 1400, true);
  bitmap.close();

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
    return reading;
  });
}

/** Plate-shaped regions in a whole photo, in photo pixel coordinates. */
export async function findPlates(photo: LoadedPhoto): Promise<Rect[]> {
  const { canvas, scale } = prepare(photo.canvas, photo.width, photo.height, 0, 1600);
  return exclusive(async (w) => {
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
}
