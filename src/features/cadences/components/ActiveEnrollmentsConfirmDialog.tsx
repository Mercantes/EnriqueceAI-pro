'use client';

import { AlertTriangle } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';

interface ActiveEnrollmentsConfirmDialogProps {
  open: boolean;
  /** Mensagem devolvida pela action (já traz a contagem de leads em andamento). */
  message: string | null;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmação exigida quando uma mudança estrutural nos passos (inserir,
 * remover, reordenar) atinge leads em andamento. A action devolve
 * `code = ACTIVE_ENROLLMENTS_CODE` e a tela reapresenta a gravação com
 * confirmação explícita do gestor.
 */
export function ActiveEnrollmentsConfirmDialog({
  open,
  message,
  pending = false,
  onConfirm,
  onCancel,
}: ActiveEnrollmentsConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onCancel(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Leads em andamento nesta cadência
          </DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <p className="text-sm text-[var(--muted-foreground)] dark:text-[var(--foreground)]">
          Se a intenção é só ajustar texto, instruções ou template de um passo, cancele e edite o passo sem
          mudar a estrutura — isso não afeta os leads em andamento.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={pending}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            {pending ? 'Salvando...' : 'Salvar mesmo assim'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
