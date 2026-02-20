'use client';

import { CheckCircle2 } from 'lucide-react';

export function ActivityEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 rounded-full bg-emerald-500/10 p-5">
        <CheckCircle2 className="h-12 w-12 text-emerald-500" />
      </div>
      <h3 className="mb-2 text-lg font-semibold">Todas as atividades foram concluídas!</h3>
      <p className="max-w-sm text-sm text-[var(--muted-foreground)]">
        Novas atividades aparecerão conforme as cadências avançarem.
      </p>
    </div>
  );
}
