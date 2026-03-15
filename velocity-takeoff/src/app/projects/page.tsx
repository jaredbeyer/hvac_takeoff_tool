'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Project } from '@/types';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/projects')
      .then((r) => (r.ok ? r.json() : []))
      .then(setProjects)
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, []);

  const statusConfig: Record<string, { label: string; color: string }> = {
    draft: {
      label: 'Draft',
      color: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200',
    },
    analyzing: {
      label: 'Analyzing',
      color: 'bg-amber-200 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200',
    },
    reviewed: {
      label: 'Reviewed',
      color: 'bg-emerald-200 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-200',
    },
    bid_sent: {
      label: 'Bid sent',
      color: 'bg-blue-200 text-blue-900 dark:bg-blue-900/50 dark:text-blue-200',
    },
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          Projects
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
          <p className="text-zinc-600 dark:text-zinc-400">No projects yet.</p>
          <Link
            href="/projects/new"
            className="mt-4 inline-block text-sm font-medium text-zinc-900 underline dark:text-zinc-100"
          >
            Create a project
          </Link>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Client
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Scale
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {projects.map((p) => {
                const sc = statusConfig[p.status] ?? {
                  label: p.status,
                  color: 'bg-zinc-200 text-zinc-700',
                };
                return (
                  <tr key={p.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/projects/${p.id}`}
                        className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                      >
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                      {p.client || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${sc.color}`}
                      >
                        {sc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                      {p.default_scale}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/projects/${p.id}/bom`}
                        className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                      >
                        BOM
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
