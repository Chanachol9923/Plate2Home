'use client';

import { useTranslations } from 'next-intl';
import { useRef, useState, type PointerEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { MIN_CROP_EDGE, normalizeDrag, type LoadedPhoto, type Rect } from '@/lib/client/image';

/**
 * Draw a box around a plate on the photo (pointer events: mouse, touch, pen). "Use the whole
 * photo" covers single-plate photos and keyboard-only users. Coordinates are in photo pixels.
 */
export function PhotoCropper({
  photo,
  url,
  label,
  onCrop,
  onRemove,
}: {
  photo: LoadedPhoto;
  url: string;
  label: string;
  onCrop: (rect: Rect) => Promise<void>;
  onRemove: () => void;
}) {
  const t = useTranslations('found');
  const surface = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const [box, setBox] = useState<Rect | null>(null);
  const [busy, setBusy] = useState(false);

  const toPhoto = (e: PointerEvent) => {
    const r = surface.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * photo.width,
      y: ((e.clientY - r.top) / r.height) * photo.height,
    };
  };

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = toPhoto(e);
    setBox(null);
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    setBox(normalizeDrag(start.current, toPhoto(e), photo.width, photo.height));
  };
  const onUp = () => {
    start.current = null;
  };

  const usable = box !== null && box.width >= MIN_CROP_EDGE && box.height >= MIN_CROP_EDGE / 2;

  const crop = async (rect: Rect) => {
    setBusy(true);
    try {
      await onCrop(rect);
      setBox(null);
    } finally {
      setBusy(false);
    }
  };

  const pct = (v: number, of: number) => `${(v / of) * 100}%`;

  return (
    <figure className="space-y-2 rounded-md border-2 border-line-soft bg-surface p-2">
      <figcaption className="flex items-center justify-between gap-2">
        <span className="font-semibold">{label}</span>
        <button
          type="button"
          onClick={onRemove}
          className="min-h-11 px-2 text-sm font-semibold text-danger underline decoration-2 underline-offset-4"
        >
          {t('removePhoto')}
        </button>
      </figcaption>
      <p className="text-sm text-ink-muted">{t('drawHint')}</p>
      <div
        ref={surface}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className="relative cursor-crosshair touch-none select-none overflow-hidden rounded-sm"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- local blob: URL of the user's own photo */}
        <img src={url} alt="" draggable={false} className="block w-full" />
        {box && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute border-[3px] border-accent shadow-[0_0_0_9999px_rgb(0_0_0/0.45)]"
            style={{
              left: pct(box.x, photo.width),
              top: pct(box.y, photo.height),
              width: pct(box.width, photo.width),
              height: pct(box.height, photo.height),
            }}
          />
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button disabled={!usable} busy={busy && usable} onClick={() => box && crop(box)}>
          {t('cropThis')}
        </Button>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => crop({ x: 0, y: 0, width: photo.width, height: photo.height })}
        >
          {t('useWhole')}
        </Button>
      </div>
    </figure>
  );
}
