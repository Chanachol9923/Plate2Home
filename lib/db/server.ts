import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { requireEnv } from '@/lib/env/server';

/**
 * The only place the Supabase secret key is used. It bypasses RLS, so:
 *  - this module is `server-only` (importing it from a client component fails the build);
 *  - ESLint forbids importing it from anywhere except lib/db/**, where narrow, named
 *    data-access functions return only safe columns (added from Phase 3 on).
 */
let client: SupabaseClient | undefined;

export function serviceClient(): SupabaseClient {
  client ??= createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SECRET_KEY'),
    {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { 'x-client-info': 'plate2home-server' } },
    },
  );
  return client;
}
