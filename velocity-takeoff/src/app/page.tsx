'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import type { Project } from '@/types';

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    fetch('/api/projects')
      .then((r) => (r.ok ? r.json() : []))
      .then(setProjects)
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, [user]);

  const statusColor: Record<string, string> = {
    draft: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200',
    analyzing: 'bg-amber-200 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200',
    reviewed: 'bg-emerald-200 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-200',
    bid_sent: 'bg-blue-200 text-blue-900 dark:bg-blue-900/50 dark:text-blue-200',
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          Velocity Takeoff Engine
        </h1>
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">
          AI-powered HVAC Bill of Materials takeoff for mechanical plans.
        </p>
        <Link
          href="/login"
          className="mt-8 inline-flex h-11 items-center justify-center rounded-lg bg-zinc-900 px-6 font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Sign in to get started
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          Recent Projects
        </h1>
        <Link
          href="/projects/new"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          New project
        </Link>
      </div>

      {loading ? (
        <div className="mt-8 text-zinc-500">Loading…</div>
      ) : projects.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
          <p className="text-zinc-600 dark:text-zinc-400">
            No projects yet. Create one to upload mechanical plans and run AI takeoff.
          </p>
          <Link
            href="/projects/new"
            className="mt-4 inline-block text-sm font-medium text-zinc-900 underline dark:text-zinc-100"
          >
            Create your first project
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {projects.slice(0, 10).map((p) => (
            <li key={p.id}>
              <Link
                href={`/projects/${p.id}`}
                className="block rounded-lg border border-zinc-200 p-4 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {p.name}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      statusColor[p.status] ?? 'bg-zinc-200 text-zinc-700'
                    }`}
                  >
                    {p.status}
                  </span>
                </div>
                {p.client && (
                  <p className="mt-1 text-sm text-zinc-500">{p.client}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
