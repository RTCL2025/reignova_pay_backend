'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';

interface TrendPoint {
  day: string;
  volume: number;
  count: number;
}

const SAMPLE_POINTS: TrendPoint[] = [
  { day: 'Aug 20', volume: 18200000, count: 420 },
  { day: 'Aug 22', volume: 21500000, count: 510 },
  { day: 'Aug 24', volume: 19800000, count: 460 },
  { day: 'Aug 26', volume: 24200000, count: 580 },
  { day: 'Aug 28', volume: 22100000, count: 530 },
  { day: 'Aug 30', volume: 26400000, count: 640 },
  { day: 'Sep 01', volume: 29800000, count: 720 },
  { day: 'Sep 03', volume: 25100000, count: 610 },
  { day: 'Sep 05', volume: 31200000, count: 780 },
  { day: 'Sep 07', volume: 28900000, count: 710 },
  { day: 'Sep 09', volume: 34500000, count: 860 },
  { day: 'Sep 11', volume: 32100000, count: 810 },
  { day: 'Sep 13', volume: 38900000, count: 940 },
  { day: 'Sep 15', volume: 36200000, count: 890 },
  { day: 'Sep 17', volume: 42500000, count: 1040 },
  { day: 'Sep 18', volume: 44800000, count: 1120 },
];

export function VolumeTrendChart({ className }: { className?: string }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(SAMPLE_POINTS.length - 1);

  const maxVal = Math.max(...SAMPLE_POINTS.map((p) => p.volume));
  const minVal = Math.min(...SAMPLE_POINTS.map((p) => p.volume)) * 0.85;

  const width = 600;
  const height = 180;
  const padding = 20;

  const points = SAMPLE_POINTS.map((p, i) => {
    const x = padding + (i / (SAMPLE_POINTS.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((p.volume - minVal) / (maxVal - minVal)) * (height - 2 * padding);
    return { x, y, ...p };
  });

  const pathD = points.reduce((acc, pt, i) => {
    return i === 0 ? `M ${pt.x},${pt.y}` : `${acc} L ${pt.x},${pt.y}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1].x},${height - padding} L ${points[0].x},${height - padding} Z`;

  const activePoint = hoveredIdx !== null ? points[hoveredIdx] : points[points.length - 1];

  return (
    <div className={cn('bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between', className)}>
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            30-Day Payment Volume
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold font-mono text-slate-900">
              {((activePoint?.volume || 0) / 1000000).toFixed(1)}M TZS
            </span>
            <span className="text-xs text-slate-500 font-mono">
              ({activePoint?.count} transactions on {activePoint?.day})
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
          <span>+24.6% growth</span>
        </div>
      </div>

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
            <g key={pt.day}>
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

      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-400 font-mono">
        <span>Aug 20, 2026</span>
        <span>Sep 05, 2026</span>
        <span>Today</span>
      </div>
    </div>
  );
}
