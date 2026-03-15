'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import type { Bbox } from '@/types';
import type { AnalysisRegion } from '@/types';

interface SheetImageWithOverlaysProps {
  imageUrl: string;
  lineItems: Array<{ id: string; bbox: Bbox | null }>;
  selectedItemId: string | null;
  analysisRegion: AnalysisRegion | null;
  onRegionChange?: (region: AnalysisRegion | null) => void;
  onItemHover?: (id: string | null) => void;
}

export function SheetImageWithOverlays({
  imageUrl,
  lineItems,
  selectedItemId,
  analysisRegion,
  onRegionChange,
  onItemHover,
}: SheetImageWithOverlaysProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgSize, setImgSize] = useState<{
    w: number;
    h: number;
    naturalW: number;
    naturalH: number;
  } | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null);
  const [mode, setMode] = useState<'view' | 'select-region'>('view');

  const updateImgSize = useCallback(() => {
    const img = imgRef.current;
    if (!img || !img.naturalWidth) return;
    const rect = img.getBoundingClientRect();
    setImgSize({
      w: rect.width,
      h: rect.height,
      naturalW: img.naturalWidth,
      naturalH: img.naturalHeight,
    });
  }, []);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    if (img.complete) updateImgSize();
    img.addEventListener('load', updateImgSize);
    const ro = new ResizeObserver(updateImgSize);
    if (img.parentElement) ro.observe(img.parentElement);
    return () => {
      img.removeEventListener('load', updateImgSize);
      ro.disconnect();
    };
  }, [imageUrl, updateImgSize]);

  const toNormalized = useCallback((clientX: number, clientY: number) => {
    const container = containerRef.current;
    const img = imgRef.current;
    if (!container || !img) return { x: 0, y: 0 };
    const rect = img.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (mode !== 'select-region') return;
      e.preventDefault();
      const { x, y } = toNormalized(e.clientX, e.clientY);
      setDrawStart({ x, y });
      setDrawCurrent({ x, y });
      setDrawing(true);
    },
    [mode, toNormalized]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (drawing && drawStart) {
        const { x, y } = toNormalized(e.clientX, e.clientY);
        setDrawCurrent({ x, y });
      }
    },
    [drawing, drawStart, toNormalized]
  );

  const handleMouseUp = useCallback(() => {
    if (drawing && drawStart && drawCurrent) {
      const x = Math.min(drawStart.x, drawCurrent.x);
      const y = Math.min(drawStart.y, drawCurrent.y);
      const width = Math.abs(drawCurrent.x - drawStart.x);
      const height = Math.abs(drawCurrent.y - drawStart.y);
      if (width > 0.02 && height > 0.02) {
        onRegionChange?.({ x, y, width, height });
      } else {
        onRegionChange?.(null);
      }
      setDrawing(false);
      setDrawStart(null);
      setDrawCurrent(null);
      setMode('view');
    }
  }, [drawing, drawStart, drawCurrent, onRegionChange]);

  const handleClickBbox = useCallback(
    (itemId: string) => {
      onItemHover?.(itemId);
    },
    [onItemHover]
  );

  const itemsWithBbox = lineItems.filter((li) => li.bbox);
  const hoveredId = selectedItemId;

  return (
    <div className="relative">
      <div className="flex items-center gap-2 pb-2">
        {onRegionChange && (
          <button
            type="button"
            onClick={() => setMode((m) => (m === 'select-region' ? 'view' : 'select-region'))}
            className={`rounded px-2 py-1 text-xs font-medium ${
              mode === 'select-region'
                ? 'bg-amber-500 text-white'
                : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200'
            }`}
          >
            {mode === 'select-region' ? 'Cancel' : 'Select takeoff region'}
          </button>
        )}
        {analysisRegion && onRegionChange && (
          <button
            type="button"
            onClick={() => onRegionChange(null)}
            className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            Clear region
          </button>
        )}
      </div>
      <div
        ref={containerRef}
        className="relative inline-block max-w-full"
        onMouseLeave={() => {
          if (drawing) handleMouseUp();
        }}
      >
        <div
          className="relative inline-block cursor-crosshair"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          style={{ touchAction: 'none' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={imageUrl}
            alt="Plan"
            className="max-h-[80vh] w-auto select-none object-contain"
            draggable={false}
          />
          {imgSize && (
            <div
              className="absolute inset-0"
              style={{
                pointerEvents: mode === 'select-region' ? 'auto' : 'none',
              }}
            >
              {/* Analysis region overlay - persists across runs */}
              {analysisRegion && (
                <div
                  className="absolute border-2 border-amber-500 bg-amber-500/20"
                  style={{
                    left: `${analysisRegion.x * 100}%`,
                    top: `${analysisRegion.y * 100}%`,
                    width: `${analysisRegion.width * 100}%`,
                    height: `${analysisRegion.height * 100}%`,
                  }}
                />
              )}
              {/* Drawing in progress */}
              {drawStart && drawCurrent && (
                <div
                  className="absolute border-2 border-amber-500 bg-amber-500/20"
                  style={{
                    left: `${Math.min(drawStart.x, drawCurrent.x) * 100}%`,
                    top: `${Math.min(drawStart.y, drawCurrent.y) * 100}%`,
                    width: `${Math.abs(drawCurrent.x - drawStart.x) * 100}%`,
                    height: `${Math.abs(drawCurrent.y - drawStart.y) * 100}%`,
                  }}
                />
              )}
              {/* Item bbox highlights - account for object-contain letterboxing */}
              <div className={mode === 'view' ? 'pointer-events-auto' : 'pointer-events-none'}>
              {itemsWithBbox.map((item) => {
                let b = item.bbox!;
                if (analysisRegion) {
                  b = {
                    x: analysisRegion.x + b.x * analysisRegion.width,
                    y: analysisRegion.y + b.y * analysisRegion.height,
                    width: b.width * analysisRegion.width,
                    height: b.height * analysisRegion.height,
                  };
                }
                const isSelected = item.id === hoveredId;
                // object-contain: compute content rect (actual image area within img element)
                const { w, h, naturalW, naturalH } = imgSize;
                const scale = Math.min(w / naturalW, h / naturalH);
                const contentW = naturalW * scale;
                const contentH = naturalH * scale;
                const offsetX = (w - contentW) / 2;
                const offsetY = (h - contentH) / 2;
                // Use pixel positioning for reliable alignment
                const leftPx = offsetX + b.x * contentW;
                const topPx = offsetY + b.y * contentH;
                const widthPx = b.width * contentW;
                const heightPx = b.height * contentH;
                return (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    className={`absolute cursor-pointer border-2 transition-colors ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-500/30'
                        : 'border-emerald-400/70 bg-emerald-400/15 hover:border-emerald-500 hover:bg-emerald-500/20'
                    }`}
                    style={{
                      left: `${leftPx}px`,
                      top: `${topPx}px`,
                      width: `${widthPx}px`,
                      height: `${heightPx}px`,
                    }}
                    onClick={() => handleClickBbox(item.id)}
                    onKeyDown={(e) => e.key === 'Enter' && handleClickBbox(item.id)}
                  />
                );
              })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
