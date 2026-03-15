'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { LineItem } from '@/types';
import { priceRectangularDuct, priceRoundDuct } from '@/lib/pricing';
import {
  computeLaborHrs,
  DEFAULT_INSTALL_RATE,
  DEFAULT_FAB_RATE,
} from '@/lib/labor';

const ROUND_SIZES = ['6', '8', '10', '12', '14'];

function PricingModal({
  profile,
  onSave,
  onClose,
  saving,
}: {
  profile: {
    rect_duct_price_per_lb: number;
    round_duct_prices: Record<string, number>;
    national_avg_install_rate?: number;
    national_avg_fab_rate?: number;
  } | null;
  onSave: (u: {
    rect_duct_price_per_lb?: number;
    round_duct_prices?: Record<string, number>;
    national_avg_install_rate?: number;
    national_avg_fab_rate?: number;
  }) => Promise<void>;
  onClose: () => void;
  saving: boolean;
}) {
  const [rectPerLb, setRectPerLb] = useState(profile?.rect_duct_price_per_lb ?? 2.5);
  const [roundPrices, setRoundPrices] = useState<Record<string, number>>(
    () => ({ ...profile?.round_duct_prices, '6': profile?.round_duct_prices?.['6'] ?? 3.5, '8': profile?.round_duct_prices?.['8'] ?? 4.25, '10': profile?.round_duct_prices?.['10'] ?? 5, '12': profile?.round_duct_prices?.['12'] ?? 6, '14': profile?.round_duct_prices?.['14'] ?? 7.5 })
  );
  const [installRate, setInstallRate] = useState(profile?.national_avg_install_rate ?? 55);
  const [fabRate, setFabRate] = useState(profile?.national_avg_fab_rate ?? 48);

  useEffect(() => {
    if (profile) {
      setRectPerLb(profile.rect_duct_price_per_lb);
      setRoundPrices((prev) => ({ ...prev, ...profile.round_duct_prices }));
      setInstallRate(profile.national_avg_install_rate ?? 55);
      setFabRate(profile.national_avg_fab_rate ?? 48);
    }
  }, [profile]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      rect_duct_price_per_lb: rectPerLb,
      round_duct_prices: roundPrices,
      national_avg_install_rate: installRate,
      national_avg_fab_rate: fabRate,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-800 dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Pricing rules</h2>
        <p className="mt-1 text-sm text-zinc-500">Defaults are used until you save a custom profile for this project.</p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Rect duct ($/lb)</label>
            <input type="number" step="0.01" min={0} value={rectPerLb} onChange={(e) => setRectPerLb(parseFloat(e.target.value) || 0)} className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Round duct ($/LF by diameter)</label>
            <div className="mt-1 flex flex-wrap gap-2">
              {ROUND_SIZES.map((d) => (
                <div key={d} className="flex items-center gap-1">
                  <span className="text-sm text-zinc-500">{d}"</span>
                  <input type="number" step="0.01" min={0} value={roundPrices[d] ?? ''} onChange={(e) => setRoundPrices((p) => ({ ...p, [d]: parseFloat(e.target.value) || 0 }))} className="w-20 rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100" />
                </div>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">National avg install ($/hr)</label>
            <input type="number" step="1" min={0} value={installRate} onChange={(e) => setInstallRate(parseFloat(e.target.value) || 0)} className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">National avg fab ($/hr)</label>
            <input type="number" step="1" min={0} value={fabRate} onChange={(e) => setFabRate(parseFloat(e.target.value) || 0)} className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-600 dark:text-zinc-300">Cancel</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface SheetInfo {
  id: string;
  page_num: number;
  sheet_number: string | null;
  sheet_title: string | null;
  filename: string;
}

export default function BomPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const [sheets, setSheets] = useState<SheetInfo[]>([]);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [projectName, setProjectName] = useState('');
  const [pricingProfile, setPricingProfile] = useState<{
    rect_duct_price_per_lb: number;
    round_duct_prices: Record<string, number>;
    national_avg_install_rate?: number;
    national_avg_fab_rate?: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<Set<string>>(new Set());
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [pricingSaving, setPricingSaving] = useState(false);

  const fetchBom = useCallback(async () => {
    const res = await fetch(`/api/bom/${projectId}`);
    if (!res.ok) {
      router.push('/projects');
      return;
    }
    const data = await res.json();
    setSheets(data.sheets ?? []);
    setLineItems(data.line_items ?? []);

    const projRes = await fetch(`/api/projects/${projectId}`);
    if (projRes.ok) {
      const proj = await projRes.json();
      setProjectName(proj.name ?? '');
    }

    const pricingRes = await fetch(`/api/projects/${projectId}/pricing`);
    if (pricingRes.ok) {
      const profile = await pricingRes.json();
      setPricingProfile({
        rect_duct_price_per_lb: profile.rect_duct_price_per_lb ?? 2.5,
        round_duct_prices: profile.round_duct_prices && typeof profile.round_duct_prices === 'object'
          ? profile.round_duct_prices
          : { '6': 3.5, '8': 4.25, '10': 5, '12': 6, '14': 7.5 },
        national_avg_install_rate: profile.national_avg_install_rate ?? 55,
        national_avg_fab_rate: profile.national_avg_fab_rate ?? 48,
      });
    } else {
      setPricingProfile({
        rect_duct_price_per_lb: 2.5,
        round_duct_prices: { '6': 3.5, '8': 4.25, '10': 5, '12': 6, '14': 7.5 },
        national_avg_install_rate: 55,
        national_avg_fab_rate: 48,
      });
    }
  }, [projectId, router]);

  useEffect(() => {
    fetchBom().finally(() => setLoading(false));
  }, [fetchBom]);

  const updateVerified = async (item: LineItem, human_verified: boolean) => {
    setUpdating((prev) => new Set(prev).add(item.id));
    try {
      const res = await fetch(`/api/bom/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: [{ id: item.id, human_verified }],
        }),
      });
      if (res.ok) {
        setLineItems((prev) =>
          prev.map((li) =>
            li.id === item.id ? { ...li, human_verified } : li
          )
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

  const computeExtendedPrice = (item: LineItem): number | null => {
    if (!pricingProfile || item.unit_price != null) {
      return item.extended_price;
    }
    const lf = item.linear_feet ?? (item.unit === 'LF' ? item.quantity : null);
    if (item.component_type === 'rectangular_duct' && item.size && item.gauge && lf != null) {
      const match = item.size.match(/(\d+)\s*[x×]\s*(\d+)/i);
      if (match) {
        const w = parseInt(match[1], 10);
        const h = parseInt(match[2], 10);
        return priceRectangularDuct(
          w,
          h,
          lf,
          item.gauge,
          pricingProfile.rect_duct_price_per_lb
        );
      }
    }
    if (item.component_type === 'round_duct' && item.size && lf != null) {
      const match = item.size.match(/(\d+)/);
      if (match) {
        const diam = parseInt(match[1], 10);
        return priceRoundDuct(
          diam,
          lf,
          pricingProfile.round_duct_prices
        );
      }
    }
    return null;
  };

  const getLaborHrs = (item: LineItem) => {
    if (
      item.install_labor_hrs != null &&
      item.fab_labor_hrs != null
    ) {
      return { installHrs: item.install_labor_hrs, fabHrs: item.fab_labor_hrs };
    }
    return computeLaborHrs(
      item.component_type,
      item.size,
      item.quantity,
      item.unit,
      item.linear_feet ?? (item.unit === 'LF' ? item.quantity : null),
      item.lbs,
      item.gauge,
      item.description
    );
  };

  const installRate =
    pricingProfile?.national_avg_install_rate ?? DEFAULT_INSTALL_RATE;
  const fabRate = pricingProfile?.national_avg_fab_rate ?? DEFAULT_FAB_RATE;

  const savePricing = async (updates: {
    rect_duct_price_per_lb?: number;
    round_duct_prices?: Record<string, number>;
    national_avg_install_rate?: number;
    national_avg_fab_rate?: number;
  }) => {
    setPricingSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/pricing`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const profile = await res.json();
        setPricingProfile({
          rect_duct_price_per_lb: profile.rect_duct_price_per_lb ?? 2.5,
          round_duct_prices: profile.round_duct_prices ?? { '6': 3.5, '8': 4.25, '10': 5, '12': 6, '14': 7.5 },
          national_avg_install_rate: profile.national_avg_install_rate ?? 55,
          national_avg_fab_rate: profile.national_avg_fab_rate ?? 48,
        });
        setShowPricingModal(false);
      }
    } finally {
      setPricingSaving(false);
    }
  };

  const exportCsv = () => {
    const headers = ['System', 'Description', 'Size', 'LF', 'Lbs', 'Qty', 'Unit', 'Extended', 'Install hrs', 'Fab hrs', 'Install $', 'Fab $'];
    const escape = (v: string | number | null | undefined) => {
      const s = v == null ? '' : String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows: string[] = [headers.join(',')];
    const sortedSystems = Object.entries(bySystem).sort(([a], [b]) => a.localeCompare(b));
    for (const [systemTag, items] of sortedSystems) {
      for (const item of items) {
        const ext = computeExtendedPrice(item) ?? item.extended_price;
        const labor = getLaborHrs(item);
        const install$ = labor ? labor.installHrs * installRate : null;
        const fab$ = labor ? labor.fabHrs * fabRate : null;
        rows.push([
          systemTag,
          item.description,
          item.size ?? '',
          item.linear_feet != null ? item.linear_feet : '',
          item.lbs != null ? item.lbs : '',
          item.quantity,
          item.unit,
          ext != null ? ext.toFixed(2) : '',
          labor != null ? labor.installHrs.toFixed(2) : '',
          labor != null ? labor.fabHrs.toFixed(2) : '',
          install$ != null ? install$.toFixed(2) : '',
          fab$ != null ? fab$.toFixed(2) : '',
        ].map(escape).join(','));
      }
    }
    rows.push('');
    rows.push(['Totals', '', 'Material', '', '', '', '', grandMaterial.toFixed(2), grandInstallHrs.toFixed(2), grandFabHrs.toFixed(2), grandInstall.toFixed(2), grandFab.toFixed(2)].map(escape).join(','));
    rows.push(['', '', 'Material + Labor', '', '', '', '', (grandMaterial + grandInstall + grandFab).toFixed(2), '', '', '', ''].map(escape).join(','));
    const csv = rows.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bom-${projectName || projectId}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const bySystem = lineItems.reduce<Record<string, LineItem[]>>((acc, li) => {
    const tag = li.system_tag || 'Other';
    if (!acc[tag]) acc[tag] = [];
    acc[tag].push(li);
    return acc;
  }, {});

  const systemTotals = Object.fromEntries(
    Object.entries(bySystem).map(([tag, items]) => {
      let materialTotal = 0;
      let installTotal = 0;
      let fabTotal = 0;
      let installHrsTotal = 0;
      let fabHrsTotal = 0;
      for (const li of items) {
        materialTotal += computeExtendedPrice(li) ?? li.extended_price ?? 0;
        const labor = getLaborHrs(li);
        if (labor) {
          installHrsTotal += labor.installHrs;
          fabHrsTotal += labor.fabHrs;
          installTotal += labor.installHrs * installRate;
          fabTotal += labor.fabHrs * fabRate;
        }
      }
      return [tag, { material: materialTotal, install: installTotal, fab: fabTotal, installHrs: installHrsTotal, fabHrs: fabHrsTotal }];
    })
  );

  const grandMaterial = Object.values(systemTotals).reduce(
    (sum, t) => sum + t.material,
    0
  );
  const grandInstall = Object.values(systemTotals).reduce(
    (sum, t) => sum + t.install,
    0
  );
  const grandFab = Object.values(systemTotals).reduce(
    (sum, t) => sum + t.fab,
    0
  );
  const grandInstallHrs = Object.values(systemTotals).reduce(
    (sum, t) => sum + t.installHrs,
    0
  );
  const grandFabHrs = Object.values(systemTotals).reduce(
    (sum, t) => sum + t.fabHrs,
    0
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="text-zinc-500">Loading…</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link
        href={`/projects/${projectId}`}
        className="mb-6 inline-block text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← Back to project
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Bill of materials
          </h1>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
            {projectName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPricingModal(true)}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Pricing rules
          </button>
          {lineItems.length > 0 && (
            <button
              type="button"
              onClick={exportCsv}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Export CSV
            </button>
          )}
        </div>
      </div>

      {showPricingModal && (
        <PricingModal
          profile={pricingProfile}
          onSave={savePricing}
          onClose={() => setShowPricingModal(false)}
          saving={pricingSaving}
        />
      )}

      {lineItems.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
          <p className="text-zinc-600 dark:text-zinc-400">
            No line items. Run AI analysis on sheets to extract components.
          </p>
          <Link
            href={`/projects/${projectId}`}
            className="mt-4 inline-block text-sm font-medium text-zinc-900 underline dark:text-zinc-100"
          >
            Go to project
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {Object.entries(bySystem)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([systemTag, items]) => (
              <div
                key={systemTag}
                className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800"
              >
                <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900/50">
                  <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {systemTag}
                  </h2>
                  <span className="font-mono text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    mat ${systemTotals[systemTag].material.toFixed(2)} • inst ${systemTotals[systemTag].install.toFixed(2)} • fab ${systemTotals[systemTag].fab.toFixed(2)}
                  </span>
                </div>
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800">
                      <th className="w-10 px-2 py-2 font-medium text-zinc-600 dark:text-zinc-400" title="Verified">
                        ✓
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-zinc-600 dark:text-zinc-400">
                        Description
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-zinc-600 dark:text-zinc-400">
                        Size
                      </th>
                      <th className="px-4 py-2 text-right font-medium text-zinc-600 dark:text-zinc-400">
                        LF
                      </th>
                      <th className="px-4 py-2 text-right font-medium text-zinc-600 dark:text-zinc-400">
                        Lbs
                      </th>
                      <th className="px-4 py-2 text-right font-medium text-zinc-600 dark:text-zinc-400">
                        Qty
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-zinc-600 dark:text-zinc-400">
                        Unit
                      </th>
                      <th className="px-4 py-2 text-right font-medium text-zinc-600 dark:text-zinc-400">
                        Extended
                      </th>
                      <th className="px-4 py-2 text-right font-medium text-zinc-600 dark:text-zinc-400">
                        Install hrs
                      </th>
                      <th className="px-4 py-2 text-right font-medium text-zinc-600 dark:text-zinc-400">
                        Fab hrs
                      </th>
                      <th className="px-4 py-2 text-right font-medium text-zinc-600 dark:text-zinc-400">
                        Install $
                      </th>
                      <th className="px-4 py-2 text-right font-medium text-zinc-600 dark:text-zinc-400">
                        Fab $
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => {
                      const ext = computeExtendedPrice(item) ?? item.extended_price;
                      const labor = getLaborHrs(item);
                      const install$ = labor
                        ? labor.installHrs * installRate
                        : null;
                      const fab$ = labor ? labor.fabHrs * fabRate : null;
                      return (
                        <tr
                          key={item.id}
                          className="border-b border-zinc-100 last:border-0 dark:border-zinc-800"
                        >
                          <td className="px-2 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={item.human_verified}
                              onChange={(e) =>
                                updateVerified(item, e.target.checked)
                              }
                              disabled={updating.has(item.id)}
                              title="Mark as verified (improves future takeoffs)"
                              className="h-4 w-4 cursor-pointer rounded border-zinc-300"
                            />
                          </td>
                          <td className="px-4 py-2 text-zinc-900 dark:text-zinc-100">
                            {item.description}
                          </td>
                          <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                            {item.size ?? '—'}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                            {item.linear_feet != null ? item.linear_feet.toFixed(1) : '—'}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                            {item.lbs != null ? item.lbs.toFixed(1) : '—'}
                          </td>
                          <td className="px-4 py-2 text-right">
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
                              className="w-20 rounded border border-zinc-200 bg-white px-2 py-1 text-right text-zinc-900 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                            />
                          </td>
                          <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                            {item.unit}
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-zinc-700 dark:text-zinc-300">
                            {ext != null ? `$${ext.toFixed(2)}` : '—'}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                            {labor != null ? labor.installHrs.toFixed(2) : '—'}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                            {labor != null ? labor.fabHrs.toFixed(2) : '—'}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                            {install$ != null ? `$${install$.toFixed(2)}` : '—'}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                            {fab$ != null ? `$${fab$.toFixed(2)}` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}

          <div className="flex justify-end border-t-2 border-zinc-900 pt-4 dark:border-zinc-100">
            <div className="text-right space-y-1">
              <p className="text-sm text-zinc-500">Material total</p>
              <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                ${grandMaterial.toFixed(2)}
              </p>
              <p className="text-sm text-zinc-500">Install hrs / Install labor (nat’l avg)</p>
              <p className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
                {grandInstallHrs.toFixed(2)} hrs · ${grandInstall.toFixed(2)}
              </p>
              <p className="text-sm text-zinc-500">Fab hrs / Fab labor (nat’l avg)</p>
              <p className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
                {grandFabHrs.toFixed(2)} hrs · ${grandFab.toFixed(2)}
              </p>
              <p className="text-sm text-zinc-500 pt-2">Material + Labor</p>
              <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                ${(grandMaterial + grandInstall + grandFab).toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
