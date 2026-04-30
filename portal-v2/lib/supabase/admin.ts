import { createClient } from "@supabase/supabase-js";

// Service-role client — bypasses RLS. Only use in API routes / server actions.
// Accepts either the new SUPABASE_SECRET_KEY name or the legacy
// SUPABASE_SERVICE_ROLE_KEY so existing .env.local files keep working.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY)!,
    {
      auth: { persistSession: false },
    }
  );
}
