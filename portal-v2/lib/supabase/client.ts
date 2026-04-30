import { createBrowserClient } from "@supabase/ssr";

// Accepts either the new NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY name or the
// legacy NEXT_PUBLIC_SUPABASE_ANON_KEY so existing .env.local files keep
// working.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!
  );
}
