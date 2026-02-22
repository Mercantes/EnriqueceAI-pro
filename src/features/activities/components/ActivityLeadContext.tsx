'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  Building2,
  Calendar,
  Check,
  Clock,
  FileText,
  Linkedin,
  Mail,
  MapPin,
  MessageSquare,
  MousePointerClick,
  Phone,
  Reply,
  Search,
  Send,
  Settings,
  User,
  XCircle,
  Zap,
} from 'lucide-react';

import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Textarea } from '@/shared/components/ui/textarea';
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

type TabId = 'contato' | 'timeline' | 'notas' | 'config';

const tabs: { id: TabId; label: string; icon: typeof User }[] = [
  { id: 'contato', label: 'Contato', icon: User },
  { id: 'timeline', label: 'Timeline', icon: Clock },
  { id: 'notas', label: 'Notas', icon: FileText },
  { id: 'config', label: 'Config', icon: Settings },
];

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ActivityLeadContext({ lead, cadenceName, stepOrder, totalSteps }: ActivityLeadContextProps) {
  const [activeTab, setActiveTab] = useState<TabId>('contato');
  const [timeline, setTimeline] = useState<ActivityTimelineEntry[]>([]);
  const [notes, setNotes] = useState('');
  const [notesSaved, setNotesSaved] = useState(false);

  // Fetch timeline
  useEffect(() => {
    const supabase = createClient();

    (async () => {
      const { data } = (await (supabase
        .from('interactions') as ReturnType<typeof supabase.from>)
        .select('id, type, channel, message_content, ai_generated, created_at')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: false })
        .limit(20)) as { data: ActivityTimelineEntry[] | null };

      setTimeline(data ?? []);
    })();
  }, [lead.id]);

  const handleSaveNotes = useCallback(() => {
    // Notes are saved in local state for now (persisted per session)
    // Future: persist to DB
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
  }, []);

  const location = [lead.municipio, lead.uf].filter(Boolean).join('/');
  const leadName = lead.nome_fantasia ?? lead.razao_social ?? lead.cnpj;

  return (
    <div className="flex h-full flex-col">
      {/* Lead header */}
      <div className="mb-3 space-y-1">
        <h3 className="text-sm font-semibold">{leadName}</h3>
        {lead.cnpj && leadName !== lead.cnpj && (
          <p className="text-xs text-[var(--muted-foreground)]">CNPJ: {lead.cnpj}</p>
        )}
      </div>

      {/* Tab bar */}
      <div className="mb-3 flex border-b border-[var(--border)]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1 border-b-2 px-2.5 pb-2 pt-1 text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-[var(--primary)] text-[var(--primary)]'
                  : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
              }`}
            >
              <Icon className="h-3 w-3" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'contato' && (
          <div className="space-y-2">
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
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
                <span className="text-sm">Porte: {lead.porte}</span>
              </div>
            )}
            {!lead.email && !lead.telefone && !location && !lead.porte && (
              <p className="text-xs text-[var(--muted-foreground)]">Nenhuma informação de contato disponível.</p>
            )}
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="space-y-3">
            {timeline.length === 0 ? (
              <p className="text-xs text-[var(--muted-foreground)]">Nenhuma interação registrada.</p>
            ) : (
              timeline.map((entry) => {
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
                      <p className="text-[10px] text-[var(--muted-foreground)]">{formatDate(entry.created_at)}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'notas' && (
          <div className="space-y-2">
            <Textarea
              placeholder="Adicione anotações sobre este lead..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[120px] resize-none text-sm"
            />
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={handleSaveNotes} disabled={!notes.trim()}>
                Salvar
              </Button>
              {notesSaved && (
                <span className="text-xs text-emerald-500">Salvo!</span>
              )}
            </div>
          </div>
        )}

        {activeTab === 'config' && (
          <div className="space-y-3">
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Cadência Atual</h4>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
                <span className="text-sm font-medium">{cadenceName}</span>
              </div>
              <p className="pl-6 text-xs text-[var(--muted-foreground)]">
                Passo {stepOrder} de {totalSteps}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
