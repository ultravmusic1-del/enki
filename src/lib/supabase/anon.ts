import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/**
 * A minimal, cookie-less Supabase client for anonymous server-side writes
 * (e.g. logging outbound clicks). Not for authenticated/user-scoped access —
 * use the SSR client in server.ts for that.
 */
export function createAnonClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
}
