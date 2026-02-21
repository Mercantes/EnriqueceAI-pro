'use client';

import { useEffect, useState } from 'react';

import {
  Building2,
  Calendar,
  Check,
  Clock,
  Linkedin,
  Mail,
  MapPin,
  MessageSquare,
  MousePointerClick,
  Phone,
  Reply,
  Search,
  Send,
  XCircle,
  Zap,
} from 'lucide-react';

import { Badge } from '@/shared/components/ui/badge';
import { createClient } from '@/lib/supabase/client';

import type { InteractionType } from '@/features/cadences/types';

import type { ActivityLead, ActivityTimelineEntry } from '../types';

interface ActivityLeadContextProps {
  lead: ActivityLead;
  cadenceName: string;
  stepOrder: number;
  totalSteps: number;
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

const channelIcon: { [key: string]: typeof Mail } = { email: Mail, whatsapp: MessageSquare, phone: Phone, linkedin: Linkedin, research: Search };

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ActivityLeadContext({ lead, cadenceName, stepOrder, totalSteps }: ActivityLeadContextProps) {
  const [timeline, setTimeline] = useState<ActivityTimelineEntry[]>([]);

  useEffect(() => {
    const supabase = createClient();

    (async () => {
      const { data } = (await (supabase
        .from('interactions') as ReturnType<typeof supabase.from>)
        .select('id, type, channel, message_content, ai_generated, created_at')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: false })
        .limit(5)) as { data: ActivityTimelineEntry[] | null };

      setTimeline(data ?? []);
    })();
  }, [lead.id]);

  const location = [lead.municipio, lead.uf].filter(Boolean).join('/');

  return (
    <div className="flex h-full flex-col space-y-4 overflow-y-auto">
      {/* Lead info */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
          Contexto do Lead
        </h3>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
            <span className="text-sm font-medium">
              {lead.nome_fantasia ?? lead.razao_social ?? lead.cnpj}
            </span>
          </div>

          {lead.cnpj && (
            <p className="pl-6 text-xs text-[var(--muted-foreground)]">
              CNPJ: {lead.cnpj}
            </p>
          )}

          {lead.email && (
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
              <span className="text-sm">{lead.email}</span>
            </div>
          )}

          {lead.telefone && (
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
              <span className="text-sm">{lead.telefone}</span>
            </div>
          )}

          {location && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
              <span className="text-sm">{location}</span>
            </div>
          )}

          {lead.porte && (
            <p className="pl-6 text-xs text-[var(--muted-foreground)]">
              Porte: {lead.porte}
            </p>
          )}
        </div>
      </div>

      {/* Cadence info */}
      <div className="space-y-2 border-t border-[var(--border)] pt-4">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
          <span className="text-sm font-medium">{cadenceName}</span>
        </div>
        <p className="pl-6 text-xs text-[var(--muted-foreground)]">
          Passo {stepOrder} de {totalSteps}
        </p>
      </div>

      {/* Mini timeline */}
      <div className="space-y-3 border-t border-[var(--border)] pt-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
          <Clock className="h-3.5 w-3.5" />
          Timeline
        </h3>

        {timeline.length === 0 ? (
          <p className="text-xs text-[var(--muted-foreground)]">
            Nenhuma interação registrada.
          </p>
        ) : (
          <div className="space-y-3">
            {timeline.map((entry) => {
              const config = typeConfig[entry.type];
              const Icon = config.icon;
              const ChannelIcon = channelIcon[entry.channel] ?? Mail;

              return (
                <div key={entry.id} className="flex gap-2">
                  <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--muted)] ${config.className}`}>
                    <Icon className="h-3 w-3" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-medium">{config.label}</span>
                      <ChannelIcon className="h-3 w-3 text-[var(--muted-foreground)]" />
                      {entry.ai_generated && (
                        <Badge variant="outline" className="h-4 px-1 text-[10px]">IA</Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-[var(--muted-foreground)]">
                      {formatDate(entry.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
