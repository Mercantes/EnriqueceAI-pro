'use client';

import { useState } from 'react';

import { CheckCircle2, FileText, Loader2, Phone, PhoneCall, SkipForward, User } from 'lucide-react';

import { Badge } from '@/shared/components/ui/badge';
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

import type { DialerQueueItem } from '../actions/fetch-dialer-queue';

interface DialerCallPanelProps {
  item: DialerQueueItem;
  isSending: boolean;
  onComplete: (callStatus: string, notes: string) => void;
  onSkip: () => void;
}

export function DialerCallPanel({ item, isSending, onComplete, onSkip }: DialerCallPanelProps) {
  const [callStatus, setCallStatus] = useState('');
  const [notes, setNotes] = useState('');

  function handleComplete() {
    onComplete(callStatus, notes);
    setCallStatus('');
    setNotes('');
  }

  return (
    <div className="flex h-full flex-col">
      {/* Origem / Destino header */}
      <div className="flex items-start justify-between rounded-lg border border-[var(--border)] p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--muted)]">
            <User className="h-5 w-5 text-[var(--muted-foreground)]" />
          </div>
          <div>
            <p className="text-xs text-[var(--muted-foreground)]">Origem</p>
            <p className="text-sm font-medium">Sua linha</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div>
            <p className="text-right text-xs text-[var(--muted-foreground)]">Destino</p>
            <p className="text-sm font-medium">{item.leadName}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10">
            <PhoneCall className="h-5 w-5 text-green-500" />
          </div>
        </div>
      </div>

      {/* Cadence context */}
      <div className="mt-3 flex items-center gap-2">
        <Badge variant="secondary" className="text-xs">
          {item.cadenceName}
        </Badge>
        <span className="text-xs text-[var(--muted-foreground)]">
          Passo {item.stepOrder} de {item.totalSteps}
        </span>
      </div>

      {/* Call section — centered */}
      <div className="flex flex-col items-center py-6">
        {item.phone ? (
          <>
            <p className="mb-1 text-2xl font-bold tabular-nums tracking-wide">
              {item.phone}
            </p>
            <a
              href={`tel:${item.phone}`}
              className="mt-3 flex h-16 w-16 items-center justify-center rounded-full bg-green-600 text-white shadow-lg transition-transform hover:scale-105 hover:bg-green-500 active:scale-95"
              title="Ligar agora"
            >
              <Phone className="h-7 w-7" />
            </a>
            <p className="mt-2 text-xs text-[var(--muted-foreground)]">Clique para ligar</p>
          </>
        ) : (
          <p className="text-sm text-[var(--muted-foreground)]">
            Sem telefone cadastrado para este lead.
          </p>
        )}
      </div>

      {/* Call status */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
          Status da Ligacao
        </Label>
        <Select value={callStatus} onValueChange={setCallStatus}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione o resultado..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="connected">Conectou — conversou com decisor</SelectItem>
            <SelectItem value="gatekeeper">Conectou — falou com intermediario</SelectItem>
            <SelectItem value="voicemail">Caixa postal</SelectItem>
            <SelectItem value="no_answer">Nao atendeu</SelectItem>
            <SelectItem value="busy">Ocupado</SelectItem>
            <SelectItem value="wrong_number">Numero errado</SelectItem>
            <SelectItem value="meeting_scheduled">Reuniao agendada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Notes */}
      <div className="mt-4 flex-1 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
          <Label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            Bloco de Notas
          </Label>
        </div>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Faca anotacoes que possam auxiliar a sua comunicacao com o cliente."
          className="min-h-[100px] resize-y"
        />
      </div>

      {/* Actions */}
      <div className="mt-4 flex items-center justify-end gap-2 border-t border-[var(--border)] pt-4">
        <Button variant="outline" onClick={onSkip} disabled={isSending}>
          <SkipForward className="mr-2 h-4 w-4" />
          Pular
        </Button>
        <Button onClick={handleComplete} disabled={isSending || !callStatus}>
          {isSending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="mr-2 h-4 w-4" />
          )}
          Concluir e avancar
        </Button>
      </div>
    </div>
  );
}
