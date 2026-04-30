import { createClient } from "@supabase/supabase-js";

// Service-role client — bypasses RLS. Only use in API routes / server actions.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: { persistSession: false },
    }
  );
}
