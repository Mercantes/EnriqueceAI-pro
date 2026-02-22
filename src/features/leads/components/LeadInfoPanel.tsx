'use client';

import { useState } from 'react';
import {
  Calendar,
  Check,
  Clock,
  FileText,
  Linkedin,
  Mail,
  MessageSquare,
  MousePointerClick,
  Pencil,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';

import type { TimelineEntry } from '@/features/cadences/cadences.contract';
import type { InteractionType } from '@/features/cadences/types';

import { formatCnpj } from '../utils/cnpj';
import { EnrichmentStatusBadge, LeadStatusBadge } from './LeadStatusBadge';
import { FitScoreBadge } from './FitScoreBadge';
import { LeadNotes } from './LeadNotes';
import { MeetimeFieldRow } from './MeetimeFieldRow';
import type { LeadInfoPanelData } from './lead-info-panel.utils';

export interface LeadInfoPanelProps {
  data: LeadInfoPanelData;
  enrollment?: { cadence_name: string; enrolled_by_email: string | null } | null;
  timeline?: TimelineEntry[];
  showConfigTab?: boolean;
  cadenceConfig?: { cadenceName: string; stepOrder: number; totalSteps: number };
  kpis?: { completed: number; open: number; conversations: number };
  onEditRequest?: () => void;
}

type TabId = 'dados' | 'timeline' | 'notas' | 'config';

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

const channelIcon: Record<string, typeof Mail> = {
  email: Mail,
  whatsapp: MessageSquare,
  phone: Phone,
  linkedin: Linkedin,
  research: Search,
};

function formatTimelineDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function LeadInfoPanel({
  data,
  enrollment,
  timeline,
  showConfigTab = false,
  cadenceConfig,
  kpis,
  onEditRequest,
}: LeadInfoPanelProps) {
  const availableTabs: { id: TabId; icon: typeof User; label: string }[] = [
    { id: 'dados', icon: User, label: 'Dados' },
    { id: 'timeline', icon: Clock, label: 'Timeline' },
    { id: 'notas', icon: FileText, label: 'Notas' },
    ...(showConfigTab ? [{ id: 'config' as const, icon: Settings, label: 'Config' }] : []),
  ];

  const [activeTab, setActiveTab] = useState<TabId>('dados');

  // Gather socio celulares
  const socioCelulares = (data.socios ?? []).flatMap((socio) =>
    (socio.celulares ?? []).map((cel) => ({
      nome: socio.nome,
      ddd: cel.ddd,
      numero: cel.numero,
      whatsapp: cel.whatsapp,
    })),
  );

  // Gather socio emails
  const socioEmails = (data.socios ?? []).flatMap((socio) =>
    (socio.emails ?? []).map((e) => ({
      nome: socio.nome,
      email: e.email,
    })),
  );

  // Format address
  const endereco = data.endereco;
  const enderecoFormatted = endereco
    ? [
        endereco.logradouro,
        endereco.numero ? `n\u00ba ${endereco.numero}` : null,
        endereco.complemento,
        endereco.bairro,
        [endereco.cidade, endereco.uf].filter(Boolean).join('/'),
        endereco.cep ? `CEP ${endereco.cep}` : null,
      ]
        .filter(Boolean)
        .join(', ')
    : null;

  // Format faturamento
  const faturamentoFormatted =
    data.faturamento_estimado != null
      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
          data.faturamento_estimado,
        )
      : null;

  return (
    <div className="flex h-full w-80 shrink-0 flex-col">
      {/* KPIs */}
      {kpis && (
        <div className="mb-4 rounded-lg border bg-[var(--card)] p-3">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-2xl font-bold">{kpis.completed}</p>
              <p className="text-[10px] font-medium uppercase text-[var(--muted-foreground)]">
                Completado
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold">{kpis.open}</p>
              <p className="text-[10px] font-medium uppercase text-[var(--muted-foreground)]">
                Aberto{kpis.open !== 1 ? 's' : ''}
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold">{kpis.conversations}</p>
              <p className="text-[10px] font-medium uppercase text-[var(--muted-foreground)]">
                Conversa{kpis.conversations !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab bar */}
      <TooltipProvider>
        <div className="mb-3 flex border-b border-[var(--border)]">
          {availableTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <Tooltip key={tab.id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex flex-1 items-center justify-center border-b-2 py-2 transition-colors ${
                      activeTab === tab.id
                        ? 'border-[var(--primary)] text-[var(--primary)]'
                        : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{tab.label}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {/* Tab Dados */}
        {activeTab === 'dados' && (
          <div className="space-y-4">
            <p className="text-[10px] italic text-[var(--muted-foreground)]">
              *Mostrando apenas campos preenchidos
            </p>

            {/* GERAL */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                Geral
              </h4>
              {data.status && (
                <MeetimeFieldRow label="Status" value={<LeadStatusBadge status={data.status} variant="meetime" />} />
              )}
              {data.enrichment_status && (
                <MeetimeFieldRow label="Enriquecimento" value={<EnrichmentStatusBadge status={data.enrichment_status} />} />
              )}
              {enrollment && (
                <MeetimeFieldRow
                  label="Cadência"
                  value={
                    <Badge variant="outline" className="text-xs">
                      {enrollment.cadence_name}
                    </Badge>
                  }
                />
              )}
              {enrollment?.enrolled_by_email && (
                <MeetimeFieldRow label="Responsável" value={enrollment.enrolled_by_email.split('@')[0] ?? ''} />
              )}
            </div>

            {/* CONTATO */}
            {(data.email || data.telefone || socioCelulares.length > 0 || socioEmails.length > 0) && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                  Contato
                </h4>
                {data.email && (
                  <MeetimeFieldRow label="Email da empresa" value={data.email} href={`mailto:${data.email}`} />
                )}
                {data.telefone && (
                  <MeetimeFieldRow label="Telefone da empresa" value={data.telefone} href={`tel:${data.telefone}`} />
                )}
                {socioCelulares.map((cel, i) => (
                  <MeetimeFieldRow
                    key={`cel-${i}`}
                    label={`Celular — ${cel.nome}`}
                    value={
                      <span className="flex items-center gap-1.5">
                        <a href={`tel:+55${cel.ddd}${cel.numero}`} className="text-[var(--primary)] hover:underline">
                          ({cel.ddd}) {cel.numero}
                        </a>
                        {cel.whatsapp && (
                          <Badge variant="outline" className="h-5 border-green-500 text-green-600 text-[10px]">
                            <MessageSquare className="mr-0.5 h-2.5 w-2.5" />
                            WhatsApp
                          </Badge>
                        )}
                      </span>
                    }
                  />
                ))}
                {socioEmails.map((se, i) => (
                  <MeetimeFieldRow
                    key={`se-${i}`}
                    label={`Email — ${se.nome}`}
                    value={se.email}
                    href={`mailto:${se.email}`}
                  />
                ))}
              </div>
            )}

            {/* EMPRESA */}
            {(data.cnpj || data.razao_social || data.nome_fantasia || data.porte || data.cnae || data.situacao_cadastral || faturamentoFormatted || enderecoFormatted || data.fit_score != null) && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                  Empresa
                </h4>
                <MeetimeFieldRow label="CNPJ" value={formatCnpj(data.cnpj)} mono />
                {data.razao_social && <MeetimeFieldRow label="Razão Social" value={data.razao_social} />}
                {data.nome_fantasia && <MeetimeFieldRow label="Nome Fantasia" value={data.nome_fantasia} />}
                {data.porte && <MeetimeFieldRow label="Porte" value={data.porte} />}
                {data.cnae && <MeetimeFieldRow label="CNAE" value={data.cnae} />}
                {data.situacao_cadastral && <MeetimeFieldRow label="Situação Cadastral" value={data.situacao_cadastral} />}
                {faturamentoFormatted && <MeetimeFieldRow label="Faturamento Estimado" value={faturamentoFormatted} />}
                {enderecoFormatted && <MeetimeFieldRow label="Endereço" value={enderecoFormatted} />}
                {data.fit_score != null && (
                  <MeetimeFieldRow label="Fit Score" value={<FitScoreBadge score={data.fit_score} />} />
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab Timeline */}
        {activeTab === 'timeline' && (
          <div className="space-y-3">
            {!timeline || timeline.length === 0 ? (
              <p className="py-4 text-center text-xs text-[var(--muted-foreground)]">
                Nenhuma interação registrada.
              </p>
            ) : (
              timeline.map((entry) => {
                const config = typeConfig[entry.type];
                const Icon = config.icon;
                const ChannelIcon = channelIcon[entry.channel] ?? Mail;

                return (
                  <div key={entry.id} className="flex gap-2">
                    <div
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--muted)] ${config.className}`}
                    >
                      <Icon className="h-3 w-3" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-medium">{config.label}</span>
                        <ChannelIcon className="h-3 w-3 text-[var(--muted-foreground)]" />
                        {entry.ai_generated && (
                          <Badge variant="outline" className="h-4 px-1 text-[10px]">
                            IA
                          </Badge>
                        )}
                      </div>
                      {entry.cadence_name && (
                        <p className="text-[10px] text-[var(--muted-foreground)]">
                          {entry.cadence_name}
                          {entry.step_order != null && ` — Passo ${entry.step_order}`}
                        </p>
                      )}
                      <p className="text-[10px] text-[var(--muted-foreground)]">
                        {formatTimelineDate(entry.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Tab Notas */}
        {activeTab === 'notas' && (
          <LeadNotes leadId={data.id} notes={data.notes} variant="inline" />
        )}

        {/* Tab Config */}
        {activeTab === 'config' && cadenceConfig && (
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              Cadência Atual
            </h4>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
              <span className="text-sm font-medium">{cadenceConfig.cadenceName}</span>
            </div>
            <p className="pl-6 text-xs text-[var(--muted-foreground)]">
              Passo {cadenceConfig.stepOrder} de {cadenceConfig.totalSteps}
            </p>
          </div>
        )}
      </div>

      {/* FAB */}
      {onEditRequest && (
        <div className="mt-3 flex justify-end">
          <Button
            size="icon"
            variant="default"
            className="h-10 w-10 rounded-full shadow-lg"
            onClick={onEditRequest}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
