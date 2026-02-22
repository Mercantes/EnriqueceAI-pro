'use client';

import { useState } from 'react';

import { CheckCircle2, Loader2, Phone } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Textarea } from '@/shared/components/ui/textarea';

interface ActivityPhonePanelProps {
  leadName: string;
  phoneNumber: string | null;
  isSending: boolean;
  onMarkDone: (notes: string) => void;
  onSkip: () => void;
}

export function ActivityPhonePanel({ leadName, phoneNumber, isSending, onMarkDone, onSkip }: ActivityPhonePanelProps) {
  const [callStatus, setCallStatus] = useState('');
  const [notes, setNotes] = useState('');

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2">
        <Phone className="h-4 w-4 text-[var(--muted-foreground)]" />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
          Ligação — {leadName}
        </h3>
      </div>

      <div className="mt-4 space-y-4 flex-1">
        {/* Phone number */}
        <div className="rounded-lg border border-[var(--border)] p-4">
          <p className="text-xs text-[var(--muted-foreground)]">Telefone</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {phoneNumber ?? 'Sem telefone cadastrado'}
          </p>
          {phoneNumber && (
            <a
              href={`tel:${phoneNumber}`}
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--primary)] hover:underline"
            >
              <Phone className="h-3.5 w-3.5" />
              Ligar agora
            </a>
          )}
        </div>

        {/* Call status */}
        <div className="space-y-1">
          <Label className="text-xs">Status da Ligação</Label>
          <Select value={callStatus} onValueChange={setCallStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o resultado..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="connected">Conectou — conversou com decisor</SelectItem>
              <SelectItem value="gatekeeper">Conectou — falou com intermediário</SelectItem>
              <SelectItem value="voicemail">Caixa postal</SelectItem>
              <SelectItem value="no_answer">Não atendeu</SelectItem>
              <SelectItem value="busy">Ocupado</SelectItem>
              <SelectItem value="wrong_number">Número errado</SelectItem>
              <SelectItem value="meeting_scheduled">Reunião agendada</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Notes */}
        <div className="space-y-1">
          <Label className="text-xs">Anotações da Ligação</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="O que foi conversado? Próximos passos?"
            className="min-h-[100px] resize-none"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 flex items-center justify-end gap-2 border-t border-[var(--border)] pt-4">
        <Button variant="outline" onClick={onSkip} disabled={isSending}>
          Pular
        </Button>
        <Button onClick={() => onMarkDone(notes)} disabled={isSending || !callStatus}>
          {isSending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="mr-2 h-4 w-4" />
          )}
          Marcar como feita
        </Button>
      </div>
    </div>
  );
}
