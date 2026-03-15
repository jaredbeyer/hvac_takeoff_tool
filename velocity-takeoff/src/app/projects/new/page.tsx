'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { storePendingUpload } from '@/lib/pending-upload';

const COMMON_SCALES = [
  { label: '1/4" = 1\'-0"', value: '1/4" = 1\'-0"' },
  { label: '1/8" = 1\'-0"', value: '1/8" = 1\'-0"' },
  { label: '1/2" = 1\'-0"', value: '1/2" = 1\'-0"' },
  { label: '1" = 10\'', value: '1" = 10\'' },
  { label: '1" = 20\'', value: '1" = 20\'' },
  { label: '1" = 30\'', value: '1" = 30\'' },
];

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [scaleOption, setScaleOption] = useState<string>('custom');
  const [customScale, setCustomScale] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const scaleValue =
    scaleOption === 'custom'
      ? customScale
      : COMMON_SCALES.find((s) => s.value === scaleOption)?.value ?? customScale;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Project name is required');
      return;
    }
    if (!scaleValue.trim()) {
      setError('Select or enter a drawing scale');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          client: client.trim() || null,
          default_scale: scaleValue.trim(),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to create project');
      }

      const projectId = data.id;

      if (file) {
        await storePendingUpload(projectId, file);
      }

      router.push(`/projects/${projectId}?from=new`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <Link
        href="/projects"
        className="mb-6 inline-block text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← Back to projects
      </Link>

      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
        New project
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Create a project and optionally upload a mechanical plan PDF.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Project name *
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Smith Office Renovation"
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>

        <div>
          <label
            htmlFor="client"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Client
          </label>
          <input
            id="client"
            type="text"
            value={client}
            onChange={(e) => setClient(e.target.value)}
            placeholder="Optional"
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>

        <div>
          <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Drawing scale *
          </span>
          <div className="mt-2 space-y-2">
            {COMMON_SCALES.map((s) => (
              <label
                key={s.value}
                className="flex cursor-pointer items-center gap-2"
              >
                <input
                  type="radio"
                  name="scale"
                  value={s.value}
                  checked={scaleOption === s.value}
                  onChange={() => setScaleOption(s.value)}
                  className="border-zinc-300 text-zinc-900 focus:ring-zinc-500"
                />
                <span className="text-sm">{s.label}</span>
              </label>
            ))}
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="scale"
                value="custom"
                checked={scaleOption === 'custom'}
                onChange={() => setScaleOption('custom')}
                className="border-zinc-300 text-zinc-900 focus:ring-zinc-500"
              />
              <span className="text-sm">Custom:</span>
              <input
                type="text"
                value={customScale}
                onChange={(e) => setCustomScale(e.target.value)}
                placeholder={"e.g. 1/4\" = 1'-0\""}
                disabled={scaleOption !== 'custom'}
                className="ml-1 flex-1 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 disabled:opacity-50"
              />
            </label>
          </div>
        </div>

        <div>
          <label
            htmlFor="file"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            PDF upload (optional)
          </label>
          <input
            id="file"
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 block w-full text-sm text-zinc-600 file:mr-4 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-200 dark:text-zinc-400 dark:file:bg-zinc-800 dark:file:text-zinc-200 dark:hover:file:bg-zinc-700"
          />
          {file && (
            <p className="mt-1 text-xs text-zinc-500">{file.name}</p>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {loading ? 'Creating…' : 'Create project'}
        </button>
      </form>
    </div>
  );
}
