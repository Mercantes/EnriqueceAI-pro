'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';

import type { SdrMetrics } from '../reports.contract';

interface SdrReportProps {
  metrics: SdrMetrics[];
}

export function SdrReport({ metrics }: SdrReportProps) {
  if (metrics.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-[var(--muted-foreground)]">
          Nenhum SDR com atividade no período selecionado.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Performance por SDR</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[var(--muted-foreground)]">
                  <th className="pb-2 pr-4 font-medium">SDR</th>
                  <th className="pb-2 pr-4 text-right font-medium">Leads</th>
                  <th className="pb-2 pr-4 text-right font-medium">Mensagens</th>
                  <th className="pb-2 pr-4 text-right font-medium">Respostas</th>
                  <th className="pb-2 pr-4 text-right font-medium">Reuniões</th>
                  <th className="pb-2 text-right font-medium">Conversão</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((m) => (
                  <tr key={m.userId} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-2 pr-4 font-medium">{m.userName}</td>
                    <td className="py-2 pr-4 text-right">{m.leadsWorked}</td>
                    <td className="py-2 pr-4 text-right">{m.messagesSent}</td>
                    <td className="py-2 pr-4 text-right">{m.replies}</td>
                    <td className="py-2 pr-4 text-right">{m.meetings}</td>
                    <td className="py-2 text-right font-medium">{m.conversionRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Comparison bars */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comparativo de Desempenho</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {metrics.map((m) => {
              const maxMessages = Math.max(...metrics.map((s) => s.messagesSent), 1);
              return (
                <div key={m.userId} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{m.userName}</span>
                    <span className="text-[var(--muted-foreground)]">
                      {m.messagesSent} msgs | {m.replies} respostas | {m.meetings} reuniões
                    </span>
                  </div>
                  <div className="h-4 w-full rounded-md bg-[var(--muted)]">
                    <div
                      className="h-full rounded-md bg-blue-500 transition-all"
                      style={{ width: `${(m.messagesSent / maxMessages) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
