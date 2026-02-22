'use client';

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { SdrTrendEntry } from '../types/team-analytics.types';

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316'];

interface SdrPerformanceTrendChartProps {
  data: SdrTrendEntry[];
  sdrNames: string[];
}

export function SdrPerformanceTrendChart({ data, sdrNames }: SdrPerformanceTrendChartProps) {
  const hasData = data.length > 0;

  if (!hasData) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-[var(--muted-foreground)]">
        Nenhum dado no período.
      </div>
    );
  }

  const interval = data.length > 30 ? Math.floor(data.length / 10) : data.length > 14 ? 2 : 0;

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11 }}
          className="text-muted-foreground"
          interval={interval}
        />
        <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" allowDecimals={false} />
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--popover)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            fontSize: '12px',
          }}
        />
        <Legend />
        {sdrNames.map((name, idx) => (
          <Line
            key={name}
            type="monotone"
            dataKey={name}
            stroke={COLORS[idx % COLORS.length]}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
