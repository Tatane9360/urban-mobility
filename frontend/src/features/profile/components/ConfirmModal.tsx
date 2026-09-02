'use client';

import { useEffect, useRef } from 'react';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

// Generic yes/no gate for a destructive action — same <dialog> mechanics as
// FavoriteAddressModal (native backdrop, focus-trap, Escape), reused wherever
// an action needs a blocking confirmation rather than an informational toast.
export function ConfirmModal({ open, title, message, confirmLabel = 'Confirmer', onConfirm, onCancel }: ConfirmModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onCancel}
      onCancel={onCancel}
      className="m-auto w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-5 text-left shadow-lg backdrop:bg-black/40 dark:border-zinc-800 dark:bg-zinc-900 [&[open]]:animate-[modal-in_150ms_ease-out]"
    >
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{title}</h2>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{message}</p>

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-10 rounded-lg border border-zinc-200 px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="h-10 rounded-lg bg-red-600 px-4 text-sm font-medium text-white transition-colors hover:bg-red-700 dark:bg-red-900 dark:hover:bg-red-800"
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
