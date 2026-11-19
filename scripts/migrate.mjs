#!/usr/bin/env node
// Applies db/migrations/*.sql in filename order, once each, recording them in
// public.schema_migrations. Safe to run on every deploy. Uses the direct
// (unpooled) connection when one is configured.
//
//   DATABASE_URL=postgres://... node scripts/migrate.mjs
//
// With no database configured it does nothing, so builds still succeed in
// demo mode.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

const url =
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL;

if (!url) {
  console.log("migrate: no DATABASE_URL set, skipping (demo mode).");
  process.exit(0);
}

const dir = join(import.meta.dirname, "..", "db", "migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const sql = postgres(url, { max: 1, onnotice: () => {} });

try {
  await sql`create table if not exists public.schema_migrations (name text primary key, applied_at timestamptz not null default now())`;
  const applied = new Set((await sql`select name from public.schema_migrations`).map((r) => r.name));

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const body = readFileSync(join(dir, file), "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`insert into public.schema_migrations (name) values (${file})`;
    });
    console.log(`migrate: applied ${file}`);
    count++;
  }
  console.log(count ? `migrate: ${count} migration(s) applied.` : "migrate: database is up to date.");
} catch (error) {
  console.error("migrate: failed —", error.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
