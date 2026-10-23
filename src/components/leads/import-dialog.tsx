"use client";

import { importLeads } from "@/app/actions/import";
import { Button } from "@/components/ui/button";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import type { ActionState } from "@/lib/actions";
import { parseCsv } from "@/lib/csv";
import { Upload } from "lucide-react";
import { useActionState, useCallback, useState } from "react";

export function ImportLeadsButton() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Upload className="size-4" /> Import CSV
      </Button>
      <Modal open={open} onClose={close} title="Import leads from CSV" description="Duplicates (same email, website or company) are skipped.">
        <ImportForm onDone={close} />
      </Modal>
    </>
  );
}

function ImportForm({ onDone }: { onDone: () => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(importLeads, {});
  const [rows, setRows] = useState<Record<string, string>[] | null>(null);
  const [fileError, setFileError] = useState<string>();

  return (
    <form action={action}>
      <input type="hidden" name="rows" value={rows ? JSON.stringify(rows) : ""} />
      <ModalBody className="space-y-4">
        <input
          type="file"
          accept=".csv,text/csv"
          aria-label="CSV file"
          className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-surface-3 file:px-3 file:py-2 file:text-sm file:text-fg"
          onChange={async (e) => {
            setFileError(undefined);
            setRows(null);
            const file = e.currentTarget.files?.[0];
            if (!file) return;
            if (file.size > 2_000_000) return setFileError("That file is over 2 MB. Split it into smaller files.");
            const parsed = parseCsv(await file.text());
            if (parsed.length === 0) return setFileError("No rows found. The first line must be a header row.");
            setRows(parsed);
          }}
        />
        {rows && (
          <p className="text-xs text-muted">
            {rows.length} row{rows.length === 1 ? "" : "s"} ready. Columns: {Object.keys(rows[0]!).join(", ")}
          </p>
        )}
        <div className="rounded-lg border border-line bg-surface-2/60 p-3 text-xs leading-relaxed text-muted">
          <p className="font-medium text-fg">Recognised columns</p>
          <p className="mt-1">
            name, company, email, phone, whatsapp, instagram, website, source, value, personalization. Research columns (what_they_do, funding, funding_date,
            lead_investor, city, fit_note, source_url, notes) are saved as a note on each lead. The starter list in{" "}
            <code>playbook/prospects-2026-10.csv</code> works as-is.
          </p>
        </div>
        {state.message && state.ok && <p className="text-xs text-emerald-300">{state.message}</p>}
      </ModalBody>
      <ModalFooter error={fileError ?? state.error}>
        <Button variant="ghost" onClick={onDone}>
          {state.ok ? "Done" : "Cancel"}
        </Button>
        <Button type="submit" variant="primary" disabled={pending || !rows}>
          {pending ? "Importing…" : rows ? `Import ${rows.length} leads` : "Import"}
        </Button>
      </ModalFooter>
    </form>
  );
}
