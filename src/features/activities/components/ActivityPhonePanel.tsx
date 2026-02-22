'use client';

import { useState } from 'react';

import { CheckCircle2, FileText, Loader2, Phone, PhoneCall, User } from 'lucide-react';

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
      {/* Origem / Destino header — Meetime-style */}
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
            <p className="text-sm font-medium">{leadName}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10">
            <PhoneCall className="h-5 w-5 text-green-500" />
          </div>
        </div>
      </div>

      {/* Call section — centered */}
      <div className="flex flex-col items-center py-8">
        {phoneNumber ? (
          <>
            <p className="mb-1 text-2xl font-bold tabular-nums tracking-wide">
              {phoneNumber}
            </p>
            <a
              href={`tel:${phoneNumber}`}
              className="mt-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-600 text-white shadow-lg transition-transform hover:scale-105 hover:bg-green-500 active:scale-95"
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
          Status da Ligação
        </Label>
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

      {/* Bloco de Notas — Meetime-style */}
      <div className="mt-5 flex-1 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
          <Label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            Bloco de Notas
          </Label>
        </div>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Faça anotações que possam auxiliar a sua comunicação com o cliente."
          className="min-h-[140px] flex-1 resize-y"
        />
      </div>

      {/* Actions */}
      <div className="mt-4 flex items-center justify-end gap-2 border-t border-[var(--border)] pt-4">
        <Button variant="outline" onClick={onSkip} disabled={isSending}>
          Pular
        </Button>
        <Button onClick={() => onMarkDone(`[${callStatus}] ${notes}`)} disabled={isSending || !callStatus}>
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
