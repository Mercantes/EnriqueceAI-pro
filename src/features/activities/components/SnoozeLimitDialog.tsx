'use client';

import { ArrowRightLeft, Play, UserX } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';

import { SNOOZE_LIMIT } from '../constants/skip-reasons';

interface SnoozeLimitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadName?: string;
  /** Fecha o diálogo e mantém o SDR na execução. */
  onExecuteNow: () => void;
  onLeadLost: () => void;
  onSwitchCadence: () => void;
}

/**
 * Terceiro "Adiar p/ amanhã" no mesmo passo: não existe 4ª opção. O SDR
 * escolhe uma saída explícita — executar agora, marcar perdido ou trocar de
 * cadência. É o que impede a fila de virar um "depois eu vejo" infinito.
 */
export function SnoozeLimitDialog({
  open,
  onOpenChange,
  leadName,
  onExecuteNow,
  onLeadLost,
  onSwitchCadence,
}: SnoozeLimitDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Esse lead já foi adiado {SNOOZE_LIMIT} vezes</DialogTitle>
          <DialogDescription>
            {leadName ? `${leadName} ` : 'Este lead '}já foi adiado {SNOOZE_LIMIT} vezes neste passo.
            Escolha o que fazer com ele agora.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <Button className="justify-start" onClick={onExecuteNow}>
            <Play className="mr-2 h-4 w-4" />
            Executar agora
          </Button>
          <Button variant="outline" className="justify-start" onClick={onSwitchCadence}>
            <ArrowRightLeft className="mr-2 h-4 w-4" />
            Trocar cadência
          </Button>
          <Button variant="outline" className="justify-start text-red-600 hover:text-red-700" onClick={onLeadLost}>
            <UserX className="mr-2 h-4 w-4" />
            Lead perdido
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
