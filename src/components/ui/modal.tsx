"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

/** Native <dialog> modal. Children usually render a <form> with a body and a footer. */
export function Modal({ open, onClose, title, description, children }: { open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode }) {
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
      onClose={onClose}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-line bg-surface p-0 text-fg shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && <p className="text-xs text-muted">{description}</p>}
        </div>
        <button type="button" onClick={onClose} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-white/5" aria-label="Close">
          <X className="size-4" />
        </button>
      </div>
      {open && children}
    </dialog>
  );
}

export function ModalBody({ children, className = "grid grid-cols-1 gap-4 sm:grid-cols-2" }: { children: ReactNode; className?: string }) {
  return <div className={`max-h-[65vh] overflow-y-auto px-5 py-5 ${className}`}>{children}</div>;
}

export function ModalFooter({ error, children }: { error?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-4">
      <p className="min-h-4 text-xs text-rose-300">{error}</p>
      <div className="flex gap-2">{children}</div>
    </div>
  );
}
