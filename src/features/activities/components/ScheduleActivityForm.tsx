'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarIcon, Linkedin, Mail, MessageSquare, Phone, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { Button } from '@/shared/components/ui/button';
import { Calendar } from '@/shared/components/ui/calendar';
import { Label } from '@/shared/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Textarea } from '@/shared/components/ui/textarea';
import { cn } from '@/lib/utils';

import { scheduleActivity } from '../actions/schedule-activity';
import { completeScheduledActivity } from '../actions/complete-scheduled-activity';
import {
  fetchScheduledActivitiesByLead,
  type LeadScheduledActivity,
} from '../actions/fetch-scheduled-activities-by-lead';

const CHANNELS = [
  { value: 'phone', label: 'Ligação', icon: Phone },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'linkedin', label: 'LinkedIn', icon: Linkedin },
  { value: 'research', label: 'Pesquisa', icon: Search },
] as const;

/** Rótulo humano do canal, considerando a Ligação via WhatsApp. */
function channelLabel(channel: string, callProvider: string | null): string {
  if (channel === 'phone' && callProvider === 'whatsapp') return 'Ligação (WhatsApp)';
  return CHANNELS.find((c) => c.value === channel)?.label ?? channel;
}

const STATUS_META: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pendente', className: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  completed: { label: 'Concluída', className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  cancelled: { label: 'Cancelada', className: 'bg-muted text-[var(--muted-foreground)]' },
};

const HOURS = Array.from({ length: 12 }, (_, i) => {
  const h = i + 8; // 08:00 to 19:00
  return [`${h.toString().padStart(2, '0')}:00`, `${h.toString().padStart(2, '0')}:30`];
}).flat();

interface ScheduleActivityFormProps {
  leadId: string;
}

export function ScheduleActivityForm({ leadId }: ScheduleActivityFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [channel, setChannel] = useState<string>('phone');
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState<string>('09:00');
  const [notes, setNotes] = useState('');
  const [scheduled, setScheduled] = useState<LeadScheduledActivity[]>([]);
  const [cancelingId, setCancelingId] = useState<string | null>(null);

  const loadScheduled = useCallback(async () => {
    const result = await fetchScheduledActivitiesByLead(leadId);
    if (result.success) setScheduled(result.data);
  }, [leadId]);

  useEffect(() => {
    let cancelled = false;
    fetchScheduledActivitiesByLead(leadId).then((result) => {
      if (cancelled) return;
      if (result.success) setScheduled(result.data);
    });
    return () => { cancelled = true; };
  }, [leadId]);

  function handleSubmit() {
    if (!date) {
      toast.error('Selecione uma data');
      return;
    }

    const [hours, minutes] = time.split(':').map(Number);
    const scheduledAt = new Date(date);
    scheduledAt.setHours(hours!, minutes!, 0, 0);

    startTransition(async () => {
      const result = await scheduleActivity({
        leadId,
        channel: channel as 'phone' | 'whatsapp' | 'email' | 'linkedin' | 'research',
        scheduledAt: scheduledAt.toISOString(),
        notes: notes.trim() || undefined,
      });

      if (result.success) {
        toast.success('Atividade agendada com sucesso');
        setDate(undefined);
        setNotes('');
        await loadScheduled();
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleCancel(id: string) {
    setCancelingId(id);
    startTransition(async () => {
      const result = await completeScheduledActivity(id, 'cancelled');
      if (result.success) {
        toast.success('Atividade cancelada');
        await loadScheduled();
        router.refresh();
      } else {
        toast.error(result.error);
      }
      setCancelingId(null);
    });
  }

  return (
    <div className="space-y-4">
      {/* Channel */}
      <div className="space-y-1.5">
        <Label>Tipo de atividade</Label>
        <Select value={channel} onValueChange={setChannel}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CHANNELS.map((ch) => (
              <SelectItem key={ch.value} value={ch.value}>
                <div className="flex items-center gap-2">
                  <ch.icon className="h-4 w-4" />
                  {ch.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Date + Time */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Data</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn('w-full justify-start text-left font-normal', !date && 'text-muted-foreground')}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecionar'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                locale={ptBR}
                disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-1.5">
          <Label>Horário</Label>
          <Select value={time} onValueChange={setTime}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HOURS.map((h) => (
                <SelectItem key={h} value={h}>{h}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label>Observações (opcional)</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ex: Ligar para confirmar interesse..."
          rows={3}
        />
      </div>

      {/* Submit */}
      <Button onClick={handleSubmit} disabled={isPending || !date} className="w-full">
        {isPending ? 'Agendando...' : 'Agendar atividade'}
      </Button>

      <p className="text-xs text-[var(--muted-foreground)] text-center">
        As cadências ativas deste lead serão encerradas automaticamente.
      </p>

      {/* Histórico de atividades agendadas */}
      {scheduled.length > 0 && (
        <div className="space-y-3 pt-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            Histórico de atividades ({scheduled.length})
          </h4>
          {scheduled.map((a) => {
            const status = STATUS_META[a.status] ?? STATUS_META.pending!;
            return (
              <div
                key={a.id}
                className={cn(
                  'rounded-lg border border-[var(--border)] p-3 space-y-2',
                  a.status !== 'pending' && 'opacity-70',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      {channelLabel(a.channel, a.callProvider)}
                    </p>
                    <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', status.className)}>
                      {status.label}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className="text-xs text-[var(--muted-foreground)]">
                      {format(new Date(a.scheduledAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                    {a.status === 'pending' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={() => handleCancel(a.id)}
                        disabled={isPending && cancelingId === a.id}
                        title="Cancelar atividade"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
                {a.notes && (
                  <p className="text-xs text-[var(--muted-foreground)] whitespace-pre-line">
                    {a.notes}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
