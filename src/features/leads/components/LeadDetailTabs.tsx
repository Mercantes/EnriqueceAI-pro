'use client';

import { useMemo, useState } from 'react';
import {
  Building2,
  Calendar,
  Clock,
  Linkedin,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react';

import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Separator } from '@/shared/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';

import type { TimelineEntry } from '@/features/cadences/cadences.contract';
import { LeadTimeline } from '@/features/cadences/components/LeadTimeline';
import { ScheduleMeetingModal } from '@/features/integrations/components/ScheduleMeetingModal';

import type { LeadRow } from '../types';
import { formatCnpj } from '../utils/cnpj';
import { EnrichmentStatusBadge, LeadStatusBadge } from './LeadStatusBadge';
import { LeadNotes } from './LeadNotes';

interface LeadDetailTabsProps {
  lead: LeadRow;
  timeline: TimelineEntry[];
  showMeeting: boolean;
  onShowMeetingChange: (open: boolean) => void;
}

type ChannelFilter = 'all' | 'research' | 'whatsapp' | 'email' | 'phone' | 'linkedin';

const channelFilters: { value: ChannelFilter; label: string; icon: typeof Mail }[] = [
  { value: 'all', label: 'Tudo', icon: Clock },
  { value: 'research', label: 'Pesquisa', icon: Search },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'phone', label: 'Ligação', icon: Phone },
  { value: 'linkedin', label: 'LinkedIn', icon: Linkedin },
];

export function LeadDetailTabs({ lead, timeline, showMeeting, onShowMeetingChange }: LeadDetailTabsProps) {
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all');

  const filteredTimeline = useMemo(() => {
    if (channelFilter === 'all') return timeline;
    return timeline.filter((e) => e.channel === channelFilter);
  }, [timeline, channelFilter]);

  const endereco = lead.endereco;
  const enderecoFormatted = endereco
    ? [
        endereco.logradouro,
        endereco.numero ? `nº ${endereco.numero}` : null,
        endereco.complemento,
        endereco.bairro,
        [endereco.cidade, endereco.uf].filter(Boolean).join('/'),
        endereco.cep ? `CEP ${endereco.cep}` : null,
      ]
        .filter(Boolean)
        .join(', ')
    : null;

  return (
    <>
      <Tabs defaultValue="historico" className="flex-1">
        <TabsList variant="line">
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="atividade">Agendar atividade</TabsTrigger>
          <TabsTrigger value="dados">Dados</TabsTrigger>
          <TabsTrigger value="reuniao">Agendar reunião</TabsTrigger>
        </TabsList>

        {/* Histórico Tab */}
        <TabsContent value="historico" className="space-y-4 pt-4">
          {/* Channel filters */}
          <div className="flex flex-wrap gap-1.5">
            {channelFilters.map(({ value, label, icon: Icon }) => (
              <Button
                key={value}
                variant={channelFilter === value ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setChannelFilter(value)}
              >
                <Icon className="mr-1 h-3 w-3" />
                {label}
              </Button>
            ))}
          </div>

          {/* Timeline */}
          <LeadTimeline entries={filteredTimeline} />

          {/* Inline Notes */}
          <LeadNotes leadId={lead.id} notes={lead.notes} />
        </TabsContent>

        {/* Agendar atividade Tab */}
        <TabsContent value="atividade" className="pt-4">
          <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-[var(--muted-foreground)]">
            Agendamento de atividades em breve
          </div>
        </TabsContent>

        {/* Dados Tab */}
        <TabsContent value="dados" className="space-y-4 pt-4">
          {/* Company Data */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4" />
                Dados da Empresa
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <InfoRow label="CNPJ" value={formatCnpj(lead.cnpj)} />
              <InfoRow label="Razão Social" value={lead.razao_social} />
              <InfoRow label="Nome Fantasia" value={lead.nome_fantasia} />
              <InfoRow label="Porte" value={lead.porte} />
              <InfoRow label="CNAE" value={lead.cnae} />
              <InfoRow label="Situação Cadastral" value={lead.situacao_cadastral} />
              {lead.faturamento_estimado != null && (
                <InfoRow
                  label="Faturamento Estimado"
                  value={new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  }).format(lead.faturamento_estimado)}
                />
              )}
              {enderecoFormatted && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]" />
                  <span>{enderecoFormatted}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Contacts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4" />
                Contatos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {lead.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                  <a href={`mailto:${lead.email}`} className="text-[var(--primary)] hover:underline">
                    {lead.email}
                  </a>
                </div>
              )}
              {lead.telefone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                  <span>{lead.telefone}</span>
                </div>
              )}
              {lead.socios && lead.socios.length > 0 && (
                <>
                  <Separator />
                  <p className="text-sm font-medium">Sócios</p>
                  <div className="space-y-3">
                    {lead.socios.map((socio, i) => (
                      <div key={i} className="rounded-md border p-3 space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium">{socio.nome}</span>
                          {socio.qualificacao && (
                            <span className="text-[var(--muted-foreground)]">— {socio.qualificacao}</span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {socio.cpf_masked && (
                            <Badge variant="outline" className="text-xs">
                              CPF: {socio.cpf_masked}
                            </Badge>
                          )}
                          {socio.participacao != null && (
                            <Badge variant="secondary" className="text-xs">
                              {socio.participacao}%
                            </Badge>
                          )}
                        </div>
                        {socio.emails && socio.emails.length > 0 && (
                          <div className="space-y-1">
                            {socio.emails.map((e, j) => (
                              <div key={j} className="flex items-center gap-2 text-sm">
                                <Mail className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                                <a href={`mailto:${e.email}`} className="text-[var(--primary)] hover:underline">
                                  {e.email}
                                </a>
                              </div>
                            ))}
                          </div>
                        )}
                        {socio.celulares && socio.celulares.length > 0 && (
                          <div className="space-y-1">
                            {socio.celulares.map((cel, j) => (
                              <div key={j} className="flex items-center gap-2 text-sm">
                                <Phone className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                                <a
                                  href={`tel:+55${cel.ddd}${cel.numero}`}
                                  className="text-[var(--primary)] hover:underline"
                                >
                                  ({cel.ddd}) {cel.numero}
                                </a>
                                {cel.whatsapp && (
                                  <Badge variant="outline" className="h-5 border-green-500 text-green-600 text-[10px]">
                                    WhatsApp
                                  </Badge>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
              {!lead.email && !lead.telefone && (!lead.socios || lead.socios.length === 0) && (
                <p className="text-sm text-[var(--muted-foreground)]">
                  Nenhum contato disponível. Tente enriquecer o lead.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Status & Dates */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4" />
                Status & Datas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--muted-foreground)]">Status</span>
                <LeadStatusBadge status={lead.status} />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--muted-foreground)]">Enriquecimento</span>
                <EnrichmentStatusBadge status={lead.enrichment_status} />
              </div>
              <Separator />
              <DateRow icon={Calendar} label="Importado em" value={lead.created_at} />
              <DateRow icon={Calendar} label="Atualizado em" value={lead.updated_at} />
              {lead.enriched_at && (
                <DateRow icon={RefreshCw} label="Enriquecido em" value={lead.enriched_at} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Agendar reunião Tab */}
        <TabsContent value="reuniao" className="pt-4">
          <div className="space-y-4">
            <p className="text-sm text-[var(--muted-foreground)]">
              Agende uma reunião com este lead via Google Calendar.
            </p>
            <Button onClick={() => onShowMeetingChange(true)}>
              <Calendar className="mr-2 h-4 w-4" />
              Agendar Reunião
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      <ScheduleMeetingModal
        open={showMeeting}
        onOpenChange={onShowMeetingChange}
        leadId={lead.id}
        leadEmail={lead.email}
        leadName={lead.nome_fantasia ?? lead.razao_social}
      />
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-[var(--muted-foreground)]">{label}</span>
      <span className="font-medium">{value ?? '—'}</span>
    </div>
  );
}

function DateRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
      <span className="text-[var(--muted-foreground)]">{label}</span>
      <span className="ml-auto">
        {new Date(value).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </span>
    </div>
  );
}
