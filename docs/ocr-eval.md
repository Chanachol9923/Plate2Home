# Plate OCR: current status

**What runs today (2026-09-28): the Tesseract fallback of spec §7.1.** No trained plate
detector or recognizer exists yet (Phase 6 needs Thai plate photos and GPU training). Nothing
here is a benchmark; the numbers below come from synthetic test images only.

## Pipeline (all in the browser; photos never leave the device)

1. **Find plates in a photo** (`findPlates`): Tesseract page-layout OCR (`PSM 3`) over the
   photo (≤ 1600 px). Words are grouped per line (Thai letters come back as separate "words");
   a group that reads like a plate number becomes a region. Stray border "letters" at the
   edges are ignored when measuring the box. The box is grown to cover the whole plate.
2. **Read each crop** (`readPlate`):
   - grey + contrast stretch;
   - long straight dark lines (plate borders) are erased;
   - page-layout pass, falling back to a single-block pass;
   - a second pass on the number line with a whitelist of plate characters;
   - if the province is still unknown, the strip below the number line is read and snapped to
     the province list.
3. **Interpretation** (`lib/ocr/interpret.ts`, unit-tested):
   - picks the plate line and the province line;
   - trims border noise read as extra digits ("205868" → "2058", with lower confidence);
   - turns characters read with < 35% confidence into `?`.
4. Found plates are only **suggested** as boxes on the photo; the user adjusts and confirms each crop (D-070). The reading **prefills** the plate card with a note saying "please check"; low confidence
   gets a stronger warning. The user can always edit it, or draw a box by hand.

## Assets and size

- Engine: tesseract.js 7.0.0 (Apache-2.0), self-hosted under `/tesseract`. The browser
  downloads one WASM core (~3.9 MB as `.wasm.js`, served compressed) plus a 111 KB worker.
- Thai model: `tha.traineddata` from `tessdata_fast` (Apache-2.0), 1.07 MB (905 KB gzipped);
  cached in IndexedDB after the first load.
- Loaded only in the found flow, when the first photo is added; progress is shown.

## Verified

- Unit tests: 16 cases for interpretation and region finding, built from real Tesseract
  output shapes.
- E2E (`e2e/ocr.spec.ts`): a photo with two plates, drawn in the browser, is scanned; both
  plates are found, both numbers read exactly, and both provinces selected. Runs at 390 and
  360 px.

## Not verified / known gaps

- **No real-photo evaluation yet.** Mud, glare, bent plates, perspective, motion blur and
  low-light photos have not been measured. Expect Tesseract to miss plates in hard photos;
  manual boxes are the fallback.
- Motorcycle plates (three lines) are only read, not found automatically.
- No plate-on-vehicle check (needs a vehicle detector, Phase 6).
- Not yet measured: latency on a throttled mid-range Android device.

## Next (Phase 6)

Collect a consented, labeled set of real found-plate photos. Build `ml/eval/` to measure this
pipeline (detection recall/precision, exact plate match, character and province accuracy,
latency) against the Phase 6 trained models (YOLOX detector + fast-plate-ocr recognizer, D-001).

## Benchmarks (2026-09-28)

A private set, not in the repo: a real photo of 22 plates laid out on a patterned floor, from
the user. Scored with local-only harnesses (`e2e/zz-*`, git-ignored).

| Step                                                   | Found (IoU ≥ 0.5) | Exact plate | Characters | Province |
| ------------------------------------------------------ | ----------------- | ----------- | ---------- | -------- |
| Tesseract text spotting + whole-crop OCR               | 0/22              | 3/22        | 45%        | 12/22    |
| Layout detector (D-072) + line-by-line reading (D-073) | 15–16/22          | 5/22        | 65%        | 15/22    |

Next: 131 freely licensed Thai plate photos from Wikimedia Commons (kept locally, licences
recorded) as a second benchmark. Then a recognizer trained on the plate font (synthetic data;
local RTX 2080 Ti) exported to ONNX for the browser.
