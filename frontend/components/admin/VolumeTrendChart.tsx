'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';

interface TrendPoint {
  day: string;
  volume: number;
  count: number;
}

interface VolumeTrendChartProps {
  className?: string;
  trend?: TrendPoint[];
  totalVolume?: number;
}

export function VolumeTrendChart({
  className,
  trend = [],
  totalVolume = 0,
}: VolumeTrendChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const displayTrend: TrendPoint[] =
    trend.length > 0
      ? trend.map((t) => {
          let label = t.day;
          try {
            const d = new Date(t.day);
            if (!isNaN(d.getTime())) {
              label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }
          } catch {
            // keep raw
          }
          return { day: label, volume: t.volume, count: t.count };
        })
      : [];

  const effectivePoints =
    displayTrend.length === 1
      ? [{ day: 'Start', volume: 0, count: 0 }, displayTrend[0]]
      : displayTrend;

  const maxVal = Math.max(...effectivePoints.map((p) => p.volume), 1);
  const minVal = Math.min(...effectivePoints.map((p) => p.volume), 0);

  const width = 600;
  const height = 180;
  const padding = 20;

  const points = effectivePoints.map((p, i) => {
    const divisor = effectivePoints.length > 1 ? effectivePoints.length - 1 : 1;
    const x = padding + (i / divisor) * (width - 2 * padding);
    const range = maxVal - minVal > 0 ? maxVal - minVal : 1;
    const y = height - padding - ((p.volume - minVal) / range) * (height - 2 * padding);
    return { x, y, ...p };
  });

  const pathD = points.reduce((acc, pt, i) => {
    return i === 0 ? `M ${pt.x},${pt.y}` : `${acc} L ${pt.x},${pt.y}`;
  }, '');

  const areaD =
    points.length > 0
      ? `${pathD} L ${points[points.length - 1].x},${height - padding} L ${points[0].x},${height - padding} Z`
      : '';

  const activePoint =
    hoveredIdx !== null && points[hoveredIdx]
      ? points[hoveredIdx]
      : points[points.length - 1];

  return (
    <div className={cn('bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between', className)}>
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Payment Volume Trend
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold font-mono text-slate-900">
              {activePoint
                ? `${(activePoint.volume / 1000000).toFixed(2)}M TZS`
                : `${(totalVolume / 1000000).toFixed(2)}M TZS`}
            </span>
            {activePoint && activePoint.count > 0 ? (
              <span className="text-xs text-slate-500 font-mono">
                ({activePoint.count} transactions on {activePoint.day})
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-1 text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
          <span>Live Telemetry</span>
        </div>
      </div>

      {points.length > 0 ? (
        <div className="relative w-full overflow-hidden mt-3">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-44 overflow-visible"
          >
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid lines */}
            <line
              x1={padding}
              y1={height - padding}
              x2={width - padding}
              y2={height - padding}
              stroke="#E2E8F0"
              strokeWidth="1"
            />
            <line
              x1={padding}
              y1={height / 2}
              x2={width - padding}
              y2={height / 2}
              stroke="#F1F5F9"
              strokeWidth="1"
              strokeDasharray="4 4"
            />

            {/* Fill Area */}
            <path d={areaD} fill="url(#areaGradient)" />

            {/* Line Path */}
            <path
              d={pathD}
              fill="none"
              stroke="#D97706"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Points */}
            {points.map((pt, i) => (
              <g key={`${pt.day}-${i}`}>
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={hoveredIdx === i ? 5 : 3}
                  fill={hoveredIdx === i ? '#B45309' : '#F59E0B'}
                  stroke="#FFFFFF"
                  strokeWidth={hoveredIdx === i ? 2 : 1.5}
                  className="cursor-pointer transition-all"
                  onMouseEnter={() => setHoveredIdx(i)}
                />
              </g>
            ))}
          </svg>
        </div>
      ) : (
        <div className="py-12 text-center text-xs text-slate-400 font-mono">
          No transaction history recorded yet. Completed payments will appear here.
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-400 font-mono">
        <span>{points[0]?.day || 'Past'}</span>
        <span>Daily Real-time Settlement</span>
        <span>{points[points.length - 1]?.day || 'Today'}</span>
      </div>
    </div>
  );
}
