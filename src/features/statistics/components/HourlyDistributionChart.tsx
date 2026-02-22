'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { HourlyCallEntry } from '../types/call-dashboard.types';

interface HourlyDistributionChartProps {
  data: HourlyCallEntry[];
}

export function HourlyDistributionChart({ data }: HourlyDistributionChartProps) {
  const hasData = data.some((d) => d.count > 0);

  if (!hasData) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-[var(--muted-foreground)]">
        Nenhuma ligação no período.
      </div>
    );
  }

  const maxCount = Math.max(...data.map((d) => d.count));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11 }}
          className="text-muted-foreground"
          interval={1}
        />
        <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" allowDecimals={false} />
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--popover)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            fontSize: '12px',
          }}
          formatter={((value: number) => [value, 'Ligações']) as never}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((entry) => (
            <Cell
              key={entry.hour}
              fill={entry.count === maxCount && maxCount > 0 ? '#f97316' : 'var(--primary)'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
