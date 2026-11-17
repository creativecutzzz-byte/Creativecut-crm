// npm run migrate — applies docs/schema.sql (idempotent) to DATABASE_URL.
// Loads .env.local when present so it works locally; on CI/Vercel pass the env directly.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set (add it to .env.local).");
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "disable" ? false : { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const sql = readFileSync(join(process.cwd(), "docs/schema.sql"), "utf8");
    await client.query(sql);
    const { rows } = await client.query(
      "select table_name from information_schema.tables where table_schema = 'outreach' order by 1",
    );
    console.log(`Outreach schema is up to date (${rows.length} tables): ${rows.map((r) => r.table_name).join(", ")}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
