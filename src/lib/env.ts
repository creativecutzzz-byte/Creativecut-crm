// Central place for reading configuration. Nothing here is ever hardcoded —
// values come from the environment (see .env.example).

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** True when Supabase is configured. Otherwise the app runs in demo mode on sample data. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
