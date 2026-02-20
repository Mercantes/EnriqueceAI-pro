'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Zap } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';

import { enrollLeads } from '@/features/cadences/actions/manage-cadences';
import { fetchActiveCadences } from '../actions/fetch-active-cadences';

interface EnrollInCadenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
}

interface ActiveCadence {
  id: string;
  name: string;
  total_steps: number;
}

export function EnrollInCadenceDialog({ open, onOpenChange, leadId }: EnrollInCadenceDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [cadences, setCadences] = useState<ActiveCadence[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load cadences when dialog becomes visible
  if (open && !loaded && !isPending) {
    startTransition(async () => {
      const result = await fetchActiveCadences();
      if (result.success) {
        setCadences(result.data);
      }
      setLoaded(true);
    });
  }

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setLoaded(false);
      setCadences([]);
    }
  }

  function handleEnroll(cadenceId: string) {
    startTransition(async () => {
      const result = await enrollLeads(cadenceId, [leadId]);
      if (result.success) {
        if (result.data.enrolled > 0) {
          toast.success('Lead inscrito na cadência');
        } else {
          toast.error(result.data.errors[0] ?? 'Erro ao inscrever');
        }
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Inscrever em Cadência
          </DialogTitle>
          <DialogDescription>
            Selecione uma cadência ativa para inscrever este lead.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-64 overflow-y-auto">
          {isPending && !loaded ? (
            <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">
              Carregando cadências...
            </p>
          ) : cadences.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">
              Nenhuma cadência ativa encontrada.
            </p>
          ) : (
            <div className="space-y-2">
              {cadences.map((cadence) => (
                <button
                  key={cadence.id}
                  type="button"
                  className="flex w-full items-center justify-between rounded-md border p-3 text-left hover:bg-[var(--muted)] transition-colors"
                  disabled={isPending}
                  onClick={() => handleEnroll(cadence.id)}
                >
                  <div>
                    <p className="text-sm font-medium">{cadence.name}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {cadence.total_steps} passos
                    </p>
                  </div>
                  <Zap className="h-4 w-4 text-[var(--muted-foreground)]" />
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
