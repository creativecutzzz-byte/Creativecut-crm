import { parseCsv } from "@/lib/csv";
import { icpConfig } from "../config";
import { logEvent } from "../db/queries";
import { q, tx } from "../db/pool";
import { normaliseRow, type CleanLead, type Rejection } from "./normalize";

// CSV -> outreach.leads with status "uploaded" (docs/guide.md, Step 5).
// Normalises, dedupes (within the file and against existing leads) and drops
// suppressed addresses, role addresses, free mail and non-allowed countries.

export interface UploadSummary {
  rows: number;
  inserted: number;
  rejected: Partial<Record<Rejection, number>>;
}

export async function importLeadsCsv(text: string, source = "csv"): Promise<UploadSummary> {
  const rows = parseCsv(text);
  const icp = icpConfig();
  const rejected: Partial<Record<Rejection, number>> = {};
  const reject = (r: Rejection) => (rejected[r] = (rejected[r] ?? 0) + 1);

  const byEmail = new Map<string, CleanLead>();
  for (const row of rows) {
    const lead = normaliseRow(row, icp, source);
    if ("rejected" in lead) reject(lead.rejected);
    else if (byEmail.has(lead.email)) reject("duplicate");
    else byEmail.set(lead.email, lead);
  }

  const emails = [...byEmail.keys()];
  let inserted = 0;
  if (emails.length) {
    const suppressed = new Set(
      (await q<{ email: string }>(`select email from outreach.suppression where email = any($1)`, [emails])).map((r) => r.email),
    );
    for (const e of suppressed) {
      byEmail.delete(e);
      reject("suppressed");
    }
    const leads = [...byEmail.values()];
    // Insert in chunks; "on conflict do nothing" dedupes against existing leads.
    await tx(async (db) => {
      for (let i = 0; i < leads.length; i += 500) {
        const chunk = leads.slice(i, i + 500);
        const res = await db.query(
          `insert into outreach.leads (email, first_name, last_name, title, company, website, country, timezone, employees, segment, source)
           select * from jsonb_to_recordset($1::jsonb) as x(email text, first_name text, last_name text, title text, company text,
                  website text, country text, timezone text, employees int, segment text, source text)
           on conflict (email) do nothing`,
          [JSON.stringify(chunk)],
        );
        inserted += res.rowCount ?? 0;
      }
    });
    const dupes = leads.length - inserted;
    if (dupes) rejected.duplicate = (rejected.duplicate ?? 0) + dupes;
  }

  await logEvent("leads_uploaded", { source, rows: rows.length, inserted, rejected });
  return { rows: rows.length, inserted, rejected };
}
