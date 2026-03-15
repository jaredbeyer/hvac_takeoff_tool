'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { getAndClearPendingUpload } from '@/lib/pending-upload';
import type { Project } from '@/types';
interface SheetWithImage {
  id: string;
  project_id: string;
  filename: string;
  page_num: number;
  sheet_number: string | null;
  sheet_title: string | null;
  sheet_types?: string[] | null;
  analysis_status: string;
  analysis_error: string | null;
  analysis_error_source: string | null;
  image_path: string | null;
  imageUrl?: string;
}

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromNew = searchParams.get('from') === 'new';
  const id = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [sheets, setSheets] = useState<SheetWithImage[]>([]);
  const [selectedSheetIds, setSelectedSheetIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const [classifying, setClassifying] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingSheetId, setDeletingSheetId] = useState<string | null>(null);
  const [dequeueingSheetId, setDequeueingSheetId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'sheets' | 'queue'>('sheets');

  const isAnalyzing = analyzing || project?.status === 'analyzing';

  const toggleSheetSelection = (sheetId: string) => {
    setSelectedSheetIds((prev) => {
      const next = new Set(prev);
      if (next.has(sheetId)) next.delete(sheetId);
      else next.add(sheetId);
      return next;
    });
  };

  const selectAllSheets = () => {
    setSelectedSheetIds(new Set(sheets.map((s) => s.id)));
  };

  const clearSelection = () => {
    setSelectedSheetIds(new Set());
  };

  const fetchData = async () => {
    const res = await fetch(`/api/projects/${id}`);
    if (!res.ok) {
      if (res.status === 404) router.push('/projects');
      return;
    }
    const data = await res.json();
    setProject(data);

    const sheetsWithUrls = await Promise.all(
      (data.sheets ?? []).map(async (s: SheetWithImage) => {
        if (!s.image_path) return { ...s };
        try {
          const urlRes = await fetch(
            `/api/storage/url?bucket=sheet-images&path=${encodeURIComponent(s.image_path)}`
          );
          if (urlRes.ok) {
            const { url } = await urlRes.json();
            return { ...s, imageUrl: url };
          }
        } catch {
          // ignore
        }
        return { ...s };
      })
    );
    setSheets(sheetsWithUrls);
    setSelectedSheetIds((prev) => {
      const ids = (data.sheets ?? []).map((s: SheetWithImage) => s.id);
      if (prev.size === 0) return new Set(ids);
      return new Set(ids.filter((id: string) => prev.has(id)));
    });
  };

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (project?.status === 'analyzing' && queueSheets.length > 0) {
      setActiveTab('queue');
    }
  }, [project?.status]); // Only react to project status (e.g. on nav back)

  useEffect(() => {
    if (!id || !fromNew) return;
    getAndClearPendingUpload(id).then((file) => {
      if (!file) return;
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      fetch(`/api/projects/${id}/upload`, {
        method: 'POST',
        body: formData,
      })
        .then((res) => {
          if (!res.ok) return res.json().then((d) => { throw new Error(d.error ?? 'Upload failed'); });
          return fetchData();
        })
        .catch((err) => alert(err instanceof Error ? err.message : 'Upload failed'))
        .finally(() => setUploading(false));
    });
  }, [id, fromNew]);

  useEffect(() => {
    if (!id) return;
    const supabase = createClient();

    const channel = supabase
      .channel(`project-${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sheets',
          filter: `project_id=eq.${id}`,
        },
        () => fetchData()
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'projects',
          filter: `id=eq.${id}`,
        },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const handleAddSheets = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.type !== 'application/pdf') return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/projects/${id}/upload`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Upload failed');
      }
      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const runClassify = async () => {
    const ids =
      selectedSheetIds.size > 0 ? Array.from(selectedSheetIds) : undefined;
    setClassifying(true);
    try {
      const res = await fetch(`/api/projects/${id}/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ids ? { sheetIds: ids } : {}),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Classification failed');
      }
      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Classification failed');
    } finally {
      setClassifying(false);
    }
  };

  const handleDeleteSheet = async (sheetId: string, label: string) => {
    if (!confirm(`Delete sheet "${label}"? This will also remove its BOM items.`)) return;
    setDeletingSheetId(sheetId);
    try {
      const res = await fetch(`/api/projects/${id}/sheets/${sheetId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Delete failed');
      }
      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeletingSheetId(null);
    }
  };

  const runTakeoff = async () => {
    const idsToRun =
      selectedSheetIds.size > 0 ? Array.from(selectedSheetIds) : null;
    if (!idsToRun || idsToRun.length === 0) return;
    abortRef.current = new AbortController();
    setAnalyzing(true);
    setActiveTab('queue');
    try {
      const res = await fetch(`/api/projects/${id}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetIds: idsToRun }),
        signal: abortRef.current.signal,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Analysis failed');
      }
      await fetchData();
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      alert(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
      abortRef.current = null;
    }
  };

  const cancelQueueItem = async (sheetId: string) => {
    setDequeueingSheetId(sheetId);
    try {
      const res = await fetch(`/api/projects/${id}/sheets/${sheetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysis_status: 'pending' }),
      });
      if (res.ok) await fetchData();
    } finally {
      setDequeueingSheetId(null);
    }
  };

  const cancelAnalysis = async () => {
    if (!abortRef.current) return;
    abortRef.current.abort();
    setAnalyzing(false);
    abortRef.current = null;
    try {
      const res = await fetch(`/api/projects/${id}/cancel-analysis`, {
        method: 'POST',
      });
      if (res.ok) await fetchData();
    } catch {
      // Ignore; UI already updated
    }
  };

  const needsClassification = sheets.some(
    (s) => !s.sheet_types || s.sheet_types.length === 0
  );

  const queueSheets = sheets.filter((s) =>
    ['queued', 'processing'].includes(s.analysis_status)
  );

  const statusConfig: Record<string, { label: string; color: string }> = {
    pending: {
      label: 'Pending',
      color: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200',
    },
    queued: {
      label: 'Queued',
      color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200',
    },
    processing: {
      label: 'Processing',
      color: 'bg-amber-200 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200',
    },
    complete: {
      label: 'Complete',
      color: 'bg-emerald-200 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-200',
    },
    error: {
      label: 'Error',
      color: 'bg-red-200 text-red-900 dark:bg-red-900/50 dark:text-red-200',
    },
  };

  if (loading || !project) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="text-zinc-500">Loading…</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link
        href="/projects"
        className="mb-6 inline-block text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← Back to projects
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {project.name}
          </h1>
          {project.client && (
            <p className="mt-1 text-zinc-600 dark:text-zinc-400">{project.client}</p>
          )}
          <p className="mt-1 text-sm text-zinc-500">
            Scale: {project.default_scale}
          </p>
          <div className="mt-2">
            <label className="text-xs font-medium text-zinc-500">Takeoff scope</label>
            <select
              value={(project as { takeoff_scope?: string }).takeoff_scope ?? 'everything'}
              onChange={async (e) => {
                const v = e.target.value as 'ductwork' | 'devices_equipment' | 'everything';
                await fetch(`/api/projects/${id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ takeoff_scope: v }),
                });
                setProject((p) => (p ? { ...p, takeoff_scope: v } : p));
              }}
              className="mt-1 block rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
            >
              <option value="everything">Everything</option>
              <option value="ductwork">Ductwork only</option>
              <option value="devices_equipment">Air devices & equipment</option>
            </select>
          </div>
        </div>
          <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/projects/${id}/bom`}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            View BOM
          </Link>
          <div className="flex items-center gap-1 rounded-lg border border-zinc-300 px-2 py-1 dark:border-zinc-600">
            <button
              type="button"
              onClick={selectAllSheets}
              className="text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Select all
            </button>
            <span className="text-zinc-400">|</span>
            <button
              type="button"
              onClick={clearSelection}
              className="text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Clear
            </button>
          </div>
          {needsClassification && (
            <button
              onClick={runClassify}
              disabled={classifying || sheets.length === 0}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800 disabled:opacity-50"
            >
              {classifying ? 'Classifying…' : 'Classify sheets'}
            </button>
          )}
          {isAnalyzing ? (
            <button
              onClick={cancelAnalysis}
              className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950 dark:text-red-300 dark:hover:bg-red-900/50"
            >
              Cancel takeoff
            </button>
          ) : (
            <button
              onClick={runTakeoff}
              disabled={
                sheets.length === 0 ||
                (selectedSheetIds.size === 0 && sheets.length > 0)
              }
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {`Run takeoff${selectedSheetIds.size > 0 ? ` (${selectedSheetIds.size})` : ''}`}
            </button>
          )}
        </div>
      </div>

      {sheets.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
          <p className="text-zinc-600 dark:text-zinc-400">
            {fromNew
              ? uploading
                ? 'Uploading and processing… Sheets will appear as they\'re ready.'
                : 'Processing your upload… Sheets will appear as they\'re ready.'
              : 'No sheets yet. Upload a PDF to add sheets.'}
          </p>
          {!fromNew && (
          <div className="mt-4">
            <input
              type="file"
              accept="application/pdf"
              onChange={handleAddSheets}
              disabled={uploading}
              className="hidden"
              id="add-sheets-input"
            />
            <label
              htmlFor="add-sheets-input"
              className={`inline-block cursor-pointer rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800 ${uploading ? 'pointer-events-none opacity-50' : ''}`}
            >
              {uploading ? 'Uploading…' : 'Add sheets (upload PDF)'}
            </label>
          </div>
          )}
        </div>
      ) : (
        <>
          <div className="mt-8 flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setActiveTab('sheets')}
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === 'sheets'
                  ? 'border-b-2 border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              Sheets
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('queue')}
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === 'queue'
                  ? 'border-b-2 border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              Queue
              {queueSheets.length > 0 && (
                <span className="ml-1.5 rounded bg-zinc-200 px-1.5 py-0.5 text-xs dark:bg-zinc-700">
                  {queueSheets.length}
                </span>
              )}
            </button>
          </div>
          {activeTab === 'sheets' && (
            <>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleAddSheets}
                  disabled={uploading}
                  className="hidden"
                  id="add-more-sheets-input"
                />
                <label
                  htmlFor="add-more-sheets-input"
                  className={`inline-block cursor-pointer rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800 ${uploading ? 'pointer-events-none opacity-50' : ''}`}
                >
                  {uploading ? 'Uploading…' : '+ Add sheets'}
                </label>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sheets.map((sheet) => {
            const sc =
              statusConfig[sheet.analysis_status] ?? statusConfig.pending;
            const isSelected = selectedSheetIds.has(sheet.id);
            return (
              <div
                key={sheet.id}
                className="group overflow-hidden rounded-lg border border-zinc-200 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
              >
                <Link
                  href={`/projects/${id}/sheets/${sheet.id}`}
                  className="block"
                >
                  <div className="relative aspect-[4/3] bg-zinc-100 dark:bg-zinc-900">
                    {sheet.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={sheet.imageUrl}
                        alt={`Sheet ${sheet.page_num}`}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-zinc-400">
                        No preview
                      </div>
                    )}
                    <span
                      className={`absolute right-2 top-2 rounded px-2 py-0.5 text-xs font-medium ${sc.color}`}
                    >
                      {sc.label}
                    </span>
                  </div>
                </Link>
                <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSheetSelection(sheet.id)}
                        className="h-4 w-4 cursor-pointer rounded border-zinc-300"
                      />
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">
                        {sheet.sheet_number || `Page ${sheet.page_num}`}
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDeleteSheet(sheet.id, sheet.sheet_number || `Page ${sheet.page_num}`);
                      }}
                      disabled={deletingSheetId === sheet.id}
                      className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50 dark:hover:text-red-400 disabled:opacity-50"
                      title="Delete sheet"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                  {sheet.sheet_title && (
                    <p className="mt-0.5 text-sm text-zinc-500">{sheet.sheet_title}</p>
                  )}
                  {sheet.analysis_error && (
                    <div className="mt-1">
                      {sheet.analysis_error_source && (
                        <span className="inline-block rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-800 dark:bg-red-900/50 dark:text-red-200">
                          {sheet.analysis_error_source}
                        </span>
                      )}
                      <pre
                        className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap break-words text-[10px] text-red-600 dark:text-red-400"
                        title={sheet.analysis_error}
                      >
                        {sheet.analysis_error}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
            </>
          )}
          {activeTab === 'queue' && (
            <div className="mt-8">
              {queueSheets.length === 0 ? (
                <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                  No jobs in queue. Select sheets and run takeoff to add them.
                </p>
              ) : (
                <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                  {queueSheets.map((sheet, index) => {
                    const sc = statusConfig[sheet.analysis_status] ?? statusConfig.pending;
                    return (
                      <li
                        key={sheet.id}
                        className="flex items-center justify-between gap-4 px-4 py-3"
                      >
                        <div className="flex items-center gap-4">
                          <span className="tabular-nums text-sm text-zinc-500">
                            {index + 1}.
                          </span>
                          <span className="font-medium text-zinc-900 dark:text-zinc-100">
                            {sheet.sheet_number || `Page ${sheet.page_num}`}
                          </span>
                          {sheet.sheet_title && (
                            <span className="text-sm text-zinc-500">
                              {sheet.sheet_title}
                            </span>
                          )}
                          <span
                            className={`rounded px-2 py-0.5 text-xs font-medium ${sc.color}`}
                          >
                            {sc.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/projects/${id}/sheets/${sheet.id}`}
                            className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                          >
                            View
                          </Link>
                          <button
                            type="button"
                            onClick={() => cancelQueueItem(sheet.id)}
                            disabled={dequeueingSheetId === sheet.id}
                            className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50 disabled:opacity-50"
                            title="Remove from queue"
                          >
                            {dequeueingSheetId === sheet.id ? '…' : 'Cancel'}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
