'use client';

import {
  ArrowRight,
  Calendar,
  Check,
  Clock,
  Linkedin,
  Mail,
  MessageSquare,
  MousePointerClick,
  Phone,
  Reply,
  Search,
  Send,
  XCircle,
} from 'lucide-react';

import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';

import type { TimelineEntry } from '../cadences.contract';
import type { InteractionType } from '../types';

interface LeadTimelineProps {
  entries: TimelineEntry[];
}

const typeConfig: Record<InteractionType, { label: string; icon: typeof Send; className: string }> = {
  sent: { label: 'Enviado', icon: Send, className: 'text-blue-500' },
  delivered: { label: 'Entregue', icon: Check, className: 'text-green-500' },
  opened: { label: 'Aberto', icon: Mail, className: 'text-[var(--primary)]' },
  clicked: { label: 'Clicou', icon: MousePointerClick, className: 'text-orange-500' },
  replied: { label: 'Respondeu', icon: Reply, className: 'text-emerald-600' },
  bounced: { label: 'Bounce', icon: XCircle, className: 'text-red-500' },
  failed: { label: 'Falhou', icon: XCircle, className: 'text-red-600' },
  meeting_scheduled: { label: 'Reunião', icon: Calendar, className: 'text-indigo-500' },
};

const channelIcon: { [k: string]: typeof Mail } = { email: Mail, whatsapp: MessageSquare, phone: Phone, linkedin: Linkedin, research: Search };
const channelLabel: { [k: string]: string } = { email: 'Email', whatsapp: 'WhatsApp', phone: 'Ligação', linkedin: 'LinkedIn', research: 'Pesquisa' };

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function LeadTimeline({ entries }: LeadTimelineProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4" />
          Timeline de Atividades
        </CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="py-4 text-center text-sm text-[var(--muted-foreground)]">
            Nenhuma interação registrada ainda.
          </p>
        ) : (
          <div className="space-y-4">
            {entries.map((entry) => {
              const config = typeConfig[entry.type];
              const Icon = config.icon;
              const ChannelIcon = channelIcon[entry.channel] ?? Mail;

              return (
                <div key={entry.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--muted)] ${config.className}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="mt-1 h-full w-px bg-[var(--border)]" />
                  </div>

                  <div className="flex-1 pb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{config.label}</span>
                      <Badge variant="outline" className="h-5 gap-1 text-xs">
                        <ChannelIcon className="h-3 w-3" />
                        {channelLabel[entry.channel] ?? entry.channel}
                      </Badge>
                      {entry.ai_generated && (
                        <Badge variant="outline" className="h-5 text-xs">IA</Badge>
                      )}
                    </div>

                    {entry.cadence_name && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
                        <ArrowRight className="h-3 w-3" />
                        {entry.cadence_name}
                        {entry.step_order != null && ` — Passo ${entry.step_order}`}
                      </div>
                    )}

                    {entry.message_content && (
                      <p className="mt-1 line-clamp-2 text-xs text-[var(--muted-foreground)]">
                        {entry.message_content}
                      </p>
                    )}

                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                      {formatDate(entry.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
