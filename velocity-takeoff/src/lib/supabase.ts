import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser Supabase client for client components and browser code.
 * Uses cookie-based auth for SSR compatibility.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
