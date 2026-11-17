import { Pool, type PoolClient, type QueryResultRow } from "pg";

// One pg pool per server instance. DATABASE_URL is the Postgres connection
// string (Supabase: Project Settings -> Database -> Connection string, use the
// transaction pooler on port 6543 for serverless). Server-only.

declare global {
  var __outreachPool: Pool | undefined;
}

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export function pool(): Pool {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set.");
  globalThis.__outreachPool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DATABASE_POOL_MAX || 5),
    ssl: process.env.DATABASE_SSL === "disable" ? false : { rejectUnauthorized: false },
    idleTimeoutMillis: 10_000,
  });
  return globalThis.__outreachPool;
}

export type Db = Pick<PoolClient, "query">;

export async function q<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = [], db: Db = pool()) {
  const res = await db.query<T>(sql, params);
  return res.rows;
}

export async function one<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = [], db: Db = pool()) {
  const rows = await q<T>(sql, params, db);
  return rows[0] ?? null;
}

/** Runs fn inside BEGIN/COMMIT, rolling back on any error. */
export async function tx<T>(fn: (db: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
