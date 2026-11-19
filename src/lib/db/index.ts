import "server-only";

import postgres from "postgres";
import { databaseUrl, isDatabaseConfigured } from "@/lib/env";
import { getSessionUserId } from "@/lib/auth";
import { callFunction, QueryBuilder, type DbResult, type DbRole, type Sql } from "./query";

export type { DbError, DbResult } from "./query";

let client: Sql | null = null;

/** The shared connection pool (one per server instance). */
export function getSql(): Sql {
  if (!isDatabaseConfigured) throw new Error("DATABASE_URL is not set");
  client ??= postgres(databaseUrl, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    // Poolers such as Neon's run in transaction mode, where prepared statements don't carry over.
    prepare: false,
    onnotice: () => {},
  });
  return client;
}

/** A database handle. Queries run as `role`, so Row Level Security applies to users and anonymous visitors. */
export class Db {
  constructor(private role: DbRole) {}

  from(table: string) {
    return new QueryBuilder(getSql(), this.role, table);
  }

  rpc(name: string, args?: Record<string, unknown>): Promise<DbResult> {
    return callFunction(getSql(), this.role, name, args);
  }
}

/** Database access as the signed-in user (or an anonymous visitor when nobody is signed in). */
export async function createDb(): Promise<Db> {
  const userId = await getSessionUserId();
  return new Db(userId ? { kind: "user", userId } : { kind: "anon" });
}

/**
 * Server-side access that bypasses Row Level Security, for callers with no
 * user session (webhooks, scheduled jobs, public forms). Returns null when no
 * database is configured.
 */
export function serverDb(): Db | null {
  return isDatabaseConfigured ? new Db({ kind: "server" }) : null;
}
