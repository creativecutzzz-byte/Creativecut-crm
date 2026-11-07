import "server-only";

import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "@/lib/env";

/**
 * Service-role client for server-to-server callers with no user session
 * (the Meta webhook). It bypasses Row Level Security, so it is only used to
 * call the narrow ingest_inbound_message / update_message_status functions.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !key) return null;
  return createClient(supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
