"use client";

import type { ReactNode } from "react";

/** A one-field form that asks for confirmation before running a destructive server action. */
export function ConfirmForm({ action, id, message, children, className }: { action: (formData: FormData) => Promise<void>; id: string; message: string; children: ReactNode; className?: string }) {
  return (
    <form
      action={action}
      className={className}
      onSubmit={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      {children}
    </form>
  );
}
