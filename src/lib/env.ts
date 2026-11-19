// Central place for reading configuration. Nothing here is ever hardcoded —
// values come from the environment (see .env.example).

/**
 * Postgres connection string (server-only). Vercel's Neon integration sets
 * DATABASE_URL; POSTGRES_URL is accepted too.
 */
export const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";

/** True when a database is configured. Otherwise the app runs in demo mode on sample data. */
export const isDatabaseConfigured = Boolean(databaseUrl);
