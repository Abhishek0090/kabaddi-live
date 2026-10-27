"use client";

import { useEffect, useRef } from "react";
import { btn } from "./ui";

type Props = {
  open: boolean;
  title: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({ open, title, confirmLabel, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={onCancel}
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl bg-white p-6 text-zinc-950 backdrop:bg-black/60 dark:bg-zinc-900 dark:text-zinc-50"
    >
      <p className="text-xl font-bold">{title}</p>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <button type="button" className={btn.secondary} onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className={btn.danger} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
