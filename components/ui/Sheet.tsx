'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';

/**
 * Bottom sheet on phones, centred dialog on wider screens. Built on the native <dialog>
 * (showModal): focus is moved in and trapped, Escape closes, the page behind is inert.
 */
export function Sheet({
  open,
  onClose,
  title,
  closeLabel,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        // A click on the backdrop (the dialog element itself) closes it.
        if (e.target === e.currentTarget) onClose();
      }}
      className="m-0 mt-auto max-h-[85dvh] w-full max-w-none rounded-t-md border-2 border-b-0 border-line bg-surface p-0 text-ink backdrop:bg-[rgb(0_0_0/0.45)] sm:m-auto sm:max-w-lg sm:rounded-md sm:border-b-2"
    >
      <div className="flex max-h-[85dvh] flex-col">
        <div className="flex items-center justify-between gap-3 border-b-2 border-line-soft px-4 py-2">
          <h2 id={titleId} className="text-lg font-bold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-sm px-3 font-semibold text-accent-ink underline decoration-2 underline-offset-4"
          >
            {closeLabel}
          </button>
        </div>
        <div className="overflow-y-auto p-4">{children}</div>
      </div>
    </dialog>
  );
}
