import type { NextConfig } from "next";

// Supabase URL and publishable (anon) key. Both are public by design (Row Level
// Security protects the data). The CRM_* names are accepted too, so an existing
// Vercel project that already stores them under those names works unchanged.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.CRM_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.CRM_SUPABASE_PUBLISHABLE_KEY || "";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The Lead Agent reads a real-data snapshot from disk when Google Cloud is not connected.
  outputFileTracingIncludes: { "/agent/**": ["./src/lib/agent/snapshot-data.json"] },
  env: {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey,
  },
};

export default nextConfig;
