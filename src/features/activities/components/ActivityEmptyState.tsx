'use client';

import { CheckCircle2, UserPlus } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';

interface ActivityEmptyStateProps {
  onStartActivities?: () => void;
}

export function ActivityEmptyState({ onStartActivities }: ActivityEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 rounded-full bg-emerald-500/10 p-5">
        <CheckCircle2 className="h-12 w-12 text-emerald-500" />
      </div>
      <h3 className="mb-2 text-lg font-semibold">Todas as atividades foram concluídas!</h3>
      <p className="max-w-sm text-sm text-[var(--muted-foreground)]">
        Novas atividades aparecerão conforme as cadências avançarem.
      </p>
      {onStartActivities && (
        <Button
          onClick={onStartActivities}
          className="mt-6 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
        >
          <UserPlus className="h-4 w-4" />
          Iniciar atividades
        </Button>
      )}
      <p className="mt-8 max-w-md text-xs italic text-[var(--muted-foreground)]">
        &quot;A persistência é o caminho do êxito.&quot; — Charles Chaplin
      </p>
    </div>
  );
}
