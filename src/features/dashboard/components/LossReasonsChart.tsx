'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { LossReasonEntry } from '../types';

interface LossReasonsChartProps {
  data: LossReasonEntry[];
}

export function LossReasonsChart({ data }: LossReasonsChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border bg-card">
        <p className="text-sm text-muted-foreground">
          Sem dados de motivos de perda
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="mb-4 text-sm font-medium text-muted-foreground">
        Motivos de Perda
      </h3>
      <ResponsiveContainer width="100%" height={Math.max(200, data.length * 40)}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 40, bottom: 5, left: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 12 }}
            className="text-muted-foreground"
          />
          <YAxis
            type="category"
            dataKey="reason"
            tick={{ fontSize: 12 }}
            className="text-muted-foreground"
            width={120}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            formatter={((value: number, _name: string, props: { payload: LossReasonEntry }) =>
              [`${value} (${props.payload.percent}%)`, 'Perdas']
            ) as never}
          />
          <Bar
            dataKey="count"
            fill="hsl(var(--destructive))"
            radius={[0, 4, 4, 0]}
            barSize={20}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
