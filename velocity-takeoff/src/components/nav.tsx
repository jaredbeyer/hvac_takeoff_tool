'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setUser(session?.user ?? null)
    );
    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await createClient().auth.signOut();
    router.push('/');
    router.refresh();
  };

  const isActive = (path: string) =>
    pathname === path || (path !== '/' && pathname.startsWith(path));

  return (
    <nav className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex gap-6">
          <Link
            href="/"
            className={`text-sm font-medium transition-colors ${
              isActive('/')
                ? 'text-zinc-900 dark:text-zinc-100'
                : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
            }`}
          >
            Dashboard
          </Link>
          {user && (
            <>
              <Link
                href="/projects"
                className={`text-sm font-medium transition-colors ${
                  isActive('/projects')
                    ? 'text-zinc-900 dark:text-zinc-100'
                    : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                }`}
              >
                Projects
              </Link>
            </>
          )}
        </div>
        <div className="flex items-center gap-4">
          {user ? (
            <>
              <span className="text-xs text-zinc-500">{user.email}</span>
              <button
                onClick={signOut}
                className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
