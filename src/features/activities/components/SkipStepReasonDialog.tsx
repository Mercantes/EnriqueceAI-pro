'use client';

import { useState } from 'react';

import { SkipForward } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/shared/components/ui/radio-group';

import { SKIP_NOTE_MAX, SKIP_REASONS, type SkipReason } from '../constants/skip-reasons';

interface SkipStepReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Nome do lead, só para o texto do diálogo. */
  leadName?: string;
  pending?: boolean;
  onConfirm: (reason: SkipReason, note?: string) => void;
}

/**
 * "Pular este passo" exige um motivo de 1 clique. Sem motivo o botão de
 * confirmar fica desabilitado — é o atrito mínimo para o gestor conseguir
 * agrupar por que os passos estão sendo pulados.
 */
export function SkipStepReasonDialog({
  open,
  onOpenChange,
  leadName,
  pending = false,
  onConfirm,
}: SkipStepReasonDialogProps) {
  const [reason, setReason] = useState<SkipReason | null>(null);
  const [note, setNote] = useState('');

  function handleOpenChange(next: boolean) {
    if (!next) {
      setReason(null);
      setNote('');
    }
    onOpenChange(next);
  }

  function handleConfirm() {
    if (!reason) return;
    const chosen = reason;
    const trimmed = note.trim() || undefined;
    // Os pais fecham por prop (open=false) sem disparar onOpenChange, então o
    // reset precisa acontecer aqui — senão o próximo "Pular" já vem marcado e
    // o atrito do motivo some (QA REL-003).
    setReason(null);
    setNote('');
    onConfirm(chosen, trimmed);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SkipForward className="h-5 w-5" />
            Pular este passo
          </DialogTitle>
          <DialogDescription>
            {leadName ? `${leadName}: a` : 'A'} cadência avança para o próximo passo sem executar este.
            Por quê?
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={reason ?? undefined}
          onValueChange={(v) => setReason(v as SkipReason)}
          className="gap-2"
        >
          {SKIP_REASONS.map((r) => (
            <label
              key={r.value}
              htmlFor={`skip-reason-${r.value}`}
              className="flex cursor-pointer items-center gap-3 rounded-md border border-[var(--border)] p-3 text-sm hover:bg-[var(--muted)]"
            >
              <RadioGroupItem id={`skip-reason-${r.value}`} value={r.value} />
              {r.label}
            </label>
          ))}
        </RadioGroup>

        {reason === 'other' && (
          <div className="space-y-1.5">
            <Label htmlFor="skip-note" className="text-xs text-[var(--muted-foreground)]">
              Descreva em poucas palavras (opcional)
            </Label>
            <Input
              id="skip-note"
              value={note}
              maxLength={SKIP_NOTE_MAX}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex.: lead pediu contato só por e-mail"
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!reason || pending}>
            Pular passo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
