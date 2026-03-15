'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { SheetImageWithOverlays } from '@/components/sheet-image-with-overlays';
import type { LineItem, AnalysisRegion } from '@/types';

export default function SheetViewPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const sheetId = params.sheetId as string;
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [sheet, setSheet] = useState<{
    sheet_number: string;
    sheet_title?: string;
    analysis_status?: string;
    analysis_error?: string | null;
    analysis_error_source?: string | null;
    analysis_region?: AnalysisRegion | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const [updating, setUpdating] = useState<Set<string>>(new Set());
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const runAnalyze = async () => {
    abortRef.current = new AbortController();
    setAnalyzing(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetIds: [sheetId] }),
        signal: abortRef.current.signal,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Analysis failed');
      }
      await fetchBom();
      const projRes = await fetch(`/api/projects/${projectId}`);
      if (projRes.ok) {
        const proj = await projRes.json();
        const sh = (proj.sheets ?? []).find((x: { id: string }) => x.id === sheetId);
        if (sh) {
          setSheet({
            sheet_number: sh.sheet_number || `Page ${sh.page_num}`,
            sheet_title: sh.sheet_title,
            analysis_status: sh.analysis_status,
            analysis_error: sh.analysis_error,
            analysis_error_source: sh.analysis_error_source,
            analysis_region: sh.analysis_region,
          });
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      alert(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
      abortRef.current = null;
    }
  };

  const cancelAnalysis = async () => {
    if (!abortRef.current) return;
    abortRef.current.abort();
    setAnalyzing(false);
    abortRef.current = null;
    try {
      const res = await fetch(`/api/projects/${projectId}/cancel-analysis`, {
        method: 'POST',
      });
      if (res.ok) await fetchBom();
    } catch {
      // Ignore
    }
  };

  const fetchBom = useCallback(async () => {
    const res = await fetch(`/api/bom/${projectId}`);
    if (!res.ok) return;
    const data = await res.json();
    const sheetItems = (data.line_items ?? []).filter(
      (li: LineItem) => li.sheet_id === sheetId
    );
    setLineItems(sheetItems);

    const s = (data.sheets ?? []).find((x: { id: string }) => x.id === sheetId) as
      | { page_num: number; sheet_number: string | null; sheet_title?: string | null; analysis_status?: string; analysis_region?: AnalysisRegion | null; analysis_error?: string | null; analysis_error_source?: string | null }
      | undefined;
    if (s)
      setSheet((prev) => ({
        sheet_number: s.sheet_number ?? prev?.sheet_number ?? `Page ${s.page_num}`,
        sheet_title: s.sheet_title ?? prev?.sheet_title,
        analysis_status: s.analysis_status ?? prev?.analysis_status,
        analysis_error: s.analysis_error ?? prev?.analysis_error ?? null,
        analysis_error_source: s.analysis_error_source ?? prev?.analysis_error_source ?? null,
        analysis_region: s.analysis_region ?? prev?.analysis_region ?? null,
      }));
  }, [projectId, sheetId]);

  useEffect(() => {
    const load = async () => {
      const projRes = await fetch(`/api/projects/${projectId}`);
      if (!projRes.ok) {
        router.push('/projects');
        return;
      }
      const proj = await projRes.json();
      const sh = (proj.sheets ?? []).find((x: { id: string }) => x.id === sheetId);
      if (!sh?.image_path) {
        setLoading(false);
        return;
      }
      setSheet({
        sheet_number: sh.sheet_number || `Page ${sh.page_num}`,
        sheet_title: sh.sheet_title,
        analysis_status: sh.analysis_status,
        analysis_error: sh.analysis_error,
        analysis_error_source: sh.analysis_error_source,
        analysis_region: sh.analysis_region,
      });

      const urlRes = await fetch(
        `/api/storage/url?bucket=sheet-images&path=${encodeURIComponent(sh.image_path)}`
      );
      if (urlRes.ok) {
        const { url } = await urlRes.json();
        setImageUrl(url);
      }
      await fetchBom();
      setLoading(false);
    };
    load();
  }, [projectId, sheetId, fetchBom, router]);

  const updateQuantity = async (item: LineItem, quantity: number) => {
    if (quantity === item.quantity) return;
    setUpdating((prev) => new Set(prev).add(item.id));
    try {
      const res = await fetch(`/api/bom/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: [{ id: item.id, quantity }],
        }),
      });
      if (res.ok) {
        setLineItems((prev) =>
          prev.map((li) => (li.id === item.id ? { ...li, quantity } : li))
        );
      }
    } finally {
      setUpdating((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-zinc-500">Loading…</div>
      </div>
    );
  }

  return (
    <div className="mx-4 flex min-h-[calc(100vh-8rem)] flex-col gap-4 py-4 lg:flex-row">
      <div className="flex-1 overflow-auto rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-white px-4 py-2 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center gap-3">
            <Link
              href={`/projects/${projectId}`}
              className="inline-flex items-center gap-1 rounded border border-zinc-300 px-2 py-1 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              ← Back
            </Link>
            {sheet?.analysis_status && (
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                  sheet.analysis_status === 'complete'
                    ? 'bg-emerald-500 text-white'
                    : sheet.analysis_status === 'error'
                      ? 'bg-red-500 text-white'
                      : sheet.analysis_status === 'processing'
                        ? 'bg-amber-500 text-white animate-pulse'
                        : 'bg-zinc-300 text-zinc-600 dark:bg-zinc-600 dark:text-zinc-300'
                }`}
                title={sheet.analysis_status}
              >
                {sheet.analysis_status === 'complete'
                  ? '✓'
                  : sheet.analysis_status === 'error'
                    ? '!'
                    : sheet.analysis_status === 'processing'
                      ? '…'
                      : '○'}
              </span>
            )}
            <div>
              <h2 className="font-medium text-zinc-900 dark:text-zinc-100">
                {sheet?.sheet_number ?? 'Sheet'}
              </h2>
              {sheet?.sheet_title && (
                <p className="text-sm text-zinc-500">{sheet.sheet_title}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
          {analyzing ? (
            <button
              onClick={cancelAnalysis}
              className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950 dark:text-red-300 dark:hover:bg-red-900/50"
            >
              Cancel
            </button>
          ) : (
            <button
              onClick={runAnalyze}
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Run AI analysis
            </button>
          )}
          </div>
          {sheet?.analysis_error && (
            <div className="mt-2 w-full rounded border border-red-200 bg-red-50 p-2 dark:border-red-900 dark:bg-red-950/50">
              {sheet?.analysis_error_source && (
                <span className="inline-block rounded bg-red-200 px-1.5 py-0.5 text-[10px] font-medium text-red-800 dark:bg-red-900 dark:text-red-200">
                  {sheet.analysis_error_source}
                </span>
              )}
              <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words text-xs text-red-700 dark:text-red-300">
                {sheet.analysis_error}
              </pre>
            </div>
          )}
        </div>
        <div className="relative min-h-[400px] p-4">
          {imageUrl ? (
            <SheetImageWithOverlays
              imageUrl={imageUrl}
              lineItems={lineItems.map((li) => ({ id: li.id, bbox: li.bbox }))}
              selectedItemId={selectedItemId}
              analysisRegion={sheet?.analysis_region ?? null}
              onRegionChange={async (region) => {
                const res = await fetch(
                  `/api/projects/${projectId}/sheets/${sheetId}`,
                  {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ analysis_region: region }),
                  }
                );
                if (res.ok) setSheet((s) => (s ? { ...s, analysis_region: region } : s));
              }}
              onItemHover={setSelectedItemId}
            />
          ) : (
            <div className="flex h-64 items-center justify-center text-zinc-500">
              No image available
            </div>
          )}
        </div>
      </div>

      <div className="w-full overflow-auto rounded-lg border border-zinc-200 bg-white lg:w-[420px] dark:border-zinc-800 dark:bg-zinc-950">
        <div className="sticky top-0 z-10 border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
          <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
            Bill of materials
          </h3>
        </div>
        <div className="max-h-[calc(100vh-12rem)] overflow-auto">
          {lineItems.length === 0 ? (
            <p className="p-4 text-sm text-zinc-500">
              No line items. Run AI analysis to extract components.
            </p>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-900/80">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-zinc-600 dark:text-zinc-400">
                    Desc
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-zinc-600 dark:text-zinc-400">
                    Size
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-zinc-600 dark:text-zinc-400">
                    LF
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-zinc-600 dark:text-zinc-400">
                    Lbs
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-zinc-600 dark:text-zinc-400">
                    Qty
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-zinc-600 dark:text-zinc-400">
                    Unit
                  </th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item) => (
                  <tr
                    key={item.id}
                    onMouseEnter={() => setSelectedItemId(item.id)}
                    onMouseLeave={() => setSelectedItemId(null)}
                    className={`border-t border-zinc-100 transition-colors dark:border-zinc-800 ${
                      selectedItemId === item.id
                        ? 'bg-emerald-100/50 dark:bg-emerald-900/20'
                        : ''
                    }`}
                  >
                    <td className="px-3 py-2 text-zinc-900 dark:text-zinc-100">
                      {item.description}
                    </td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                      {item.size ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                      {item.linear_feet != null ? item.linear_feet.toFixed(1) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                      {item.lbs != null ? item.lbs.toFixed(1) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min={0}
                        step="0.1"
                        value={item.quantity}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (!Number.isNaN(v) && v >= 0) {
                            updateQuantity(item, v);
                          }
                        }}
                        disabled={updating.has(item.id)}
                        className="w-16 rounded border border-zinc-200 bg-white px-1 py-0.5 text-right text-zinc-900 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                      />
                    </td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                      {item.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
