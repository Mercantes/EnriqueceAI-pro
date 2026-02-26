'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import {
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  Phone,
  PhoneCall,
  PhoneOff,
  User,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Label } from '@/shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Textarea } from '@/shared/components/ui/textarea';

import {
  initiateApi4ComCall,
  hangupApi4ComCall,
} from '@/features/calls/actions/initiate-api4com-call';

type CallState = 'idle' | 'calling' | 'connected' | 'ended';

interface ActivityPhonePanelProps {
  leadName: string;
  leadId: string;
  phoneNumber: string | null;
  isSending: boolean;
  onMarkDone: (notes: string) => void;
  onSkip: () => void;
}

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function ActivityPhonePanel({
  leadName,
  leadId,
  phoneNumber,
  isSending,
  onMarkDone,
  onSkip,
}: ActivityPhonePanelProps) {
  const [callState, setCallState] = useState<CallState>('idle');
  const [api4comCallId, setApi4comCallId] = useState<string | null>(null);
  const [callStatus, setCallStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [callDuration, setCallDuration] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isPending, startTransition] = useTransition();

  // Timer for call duration
  useEffect(() => {
    if (callState === 'calling' || callState === 'connected') {
      const id = setInterval(() => setElapsed((prev) => prev + 1), 1000);
      timerRef.current = id;
      return () => clearInterval(id);
    }
    return undefined;
  }, [callState]);

  function handleInitiateCall() {
    if (!phoneNumber) return;

    setElapsed(0);
    startTransition(async () => {
      setCallState('calling');

      const result = await initiateApi4ComCall({
        phone: phoneNumber,
        leadId,
      });

      if (!result.success) {
        toast.error(result.error);
        setCallState('idle');
        return;
      }

      setApi4comCallId(result.data.api4comId);
      setCallState('connected');
    });
  }

  function handleHangup() {
    setCallDuration(elapsed);

    if (!api4comCallId) {
      setCallState('ended');
      return;
    }

    startTransition(async () => {
      const result = await hangupApi4ComCall(api4comCallId);
      if (!result.success) {
        toast.error(result.error);
      }
      setCallState('ended');
    });
  }

  function handleSubmitResult() {
    onMarkDone(`[${callStatus}] ${notes}`.trim());
    setCallStatus('');
    setNotes('');
    setCallState('idle');
    setApi4comCallId(null);
    setElapsed(0);
  }

  function handleDismissModal() {
    // Allow closing without completing — go back to idle
    setCallState('idle');
    setCallStatus('');
    setNotes('');
    setApi4comCallId(null);
    setElapsed(0);
  }

  const isInCall = callState === 'calling' || callState === 'connected';

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
            <p className="text-sm font-medium">{leadName}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10">
            <PhoneCall className="h-5 w-5 text-green-500" />
          </div>
        </div>
      </div>

      {/* Call section — centered */}
      <div className="flex flex-1 flex-col items-center justify-center py-8">
        {phoneNumber ? (
          <>
            <p className="mb-1 text-2xl font-bold tabular-nums tracking-wide">
              {phoneNumber}
            </p>

            {/* Timer display during call */}
            {isInCall && (
              <p className="mb-2 font-mono text-lg tabular-nums text-[var(--muted-foreground)]">
                {formatTimer(elapsed)}
              </p>
            )}

            {/* Call action buttons */}
            <div className="mt-3 flex items-center gap-4">
              {callState === 'idle' && (
                <button
                  onClick={handleInitiateCall}
                  disabled={isPending}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-green-600 text-white shadow-lg transition-transform hover:scale-105 hover:bg-green-500 active:scale-95 disabled:opacity-50"
                  title="Ligar via API4COM"
                >
                  <Phone className="h-7 w-7" />
                </button>
              )}

              {callState === 'calling' && (
                <>
                  <div className="flex h-16 w-16 animate-pulse items-center justify-center rounded-full bg-yellow-500 text-white shadow-lg">
                    <Phone className="h-7 w-7" />
                  </div>
                  <button
                    onClick={handleHangup}
                    disabled={isPending}
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-white shadow transition-transform hover:scale-105 hover:bg-red-500 active:scale-95"
                    title="Desligar"
                  >
                    <PhoneOff className="h-5 w-5" />
                  </button>
                </>
              )}

              {callState === 'connected' && (
                <button
                  onClick={handleHangup}
                  disabled={isPending}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition-transform hover:scale-105 hover:bg-red-500 active:scale-95"
                  title="Desligar"
                >
                  <PhoneOff className="h-7 w-7" />
                </button>
              )}
            </div>

            <p className="mt-2 text-xs text-[var(--muted-foreground)]">
              {callState === 'idle' && 'Clique para ligar via API4COM'}
              {callState === 'calling' && 'Chamando...'}
              {callState === 'connected' && 'Em chamada'}
            </p>
          </>
        ) : (
          <p className="text-sm text-[var(--muted-foreground)]">
            Sem telefone cadastrado para este lead.
          </p>
        )}
      </div>

      {/* Actions — skip only (result is handled via modal) */}
      <div className="mt-4 flex items-center justify-end gap-2 border-t border-[var(--border)] pt-4">
        <Button variant="outline" onClick={onSkip} disabled={isSending || isInCall}>
          <Clock className="mr-2 h-4 w-4" />
          Pular
        </Button>
      </div>

      {/* Post-call result modal */}
      <Dialog open={callState === 'ended'} onOpenChange={(open) => !open && handleDismissModal()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Resultado da Ligação</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Call duration summary */}
            <div className="flex items-center justify-between rounded-lg bg-[var(--muted)] px-4 py-3">
              <div>
                <p className="text-sm font-medium">{leadName}</p>
                <p className="text-xs text-[var(--muted-foreground)]">{phoneNumber}</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm tabular-nums">{formatTimer(callDuration)}</p>
                <p className="text-xs text-[var(--muted-foreground)]">Duração</p>
              </div>
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

            {/* Notes */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                <Label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                  Anotações
                </Label>
              </div>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Faça anotações sobre a ligação..."
                className="min-h-[100px] resize-y"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleDismissModal}>
              Cancelar
            </Button>
            <Button onClick={handleSubmitResult} disabled={isSending || !callStatus}>
              {isSending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Concluir ligação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
