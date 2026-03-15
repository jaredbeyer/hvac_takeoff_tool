import { createClient } from '@supabase/supabase-js';

/**
 * Server Supabase client with service role for API routes and server-side operations.
 * Bypasses RLS — use only in trusted server context (API routes, server actions).
 */
export function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(url, serviceRoleKey);
}
