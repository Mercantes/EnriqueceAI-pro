'use client';

import { useCallback, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
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
  Save,
  Search,
  Send,
  Settings,
  User,
  X,
  XCircle,
  Zap,
} from 'lucide-react';

import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';

import { updateLead } from '../actions/update-lead';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';

import type { TimelineEntry } from '@/features/cadences/cadences.contract';
import type { InteractionType } from '@/features/cadences/types';

import { EnrichmentStatusBadge, LeadStatusBadge } from './LeadStatusBadge';
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
}: LeadInfoPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const availableTabs: { id: TabId; icon: typeof User; label: string }[] = [
    { id: 'dados', icon: User, label: 'Dados' },
    { id: 'timeline', icon: Clock, label: 'Timeline' },
    { id: 'notas', icon: FileText, label: 'Notas' },
    ...(showConfigTab ? [{ id: 'config' as const, icon: Settings, label: 'Config' }] : []),
  ];

  const [activeTab, setActiveTab] = useState<TabId>('dados');
  const [isEditing, setIsEditing] = useState(false);

  // Primary contact (first socio)
  const primarySocio = data.socios?.[0] ?? null;

  const primaryEmail = (data.socios ?? []).flatMap((s) => s.emails ?? []).sort((a, b) => a.ranking - b.ranking)[0]?.email ?? data.email ?? '';

  const [editFields, setEditFields] = useState({
    razao_social: data.razao_social ?? '',
    nome_fantasia: data.nome_fantasia ?? '',
    email: primaryEmail,
    telefone: data.telefone ?? '',
    socio_nome: primarySocio?.nome ?? '',
    socio_qualificacao: primarySocio?.qualificacao ?? '',
    instagram: data.instagram ?? '',
    linkedin: data.linkedin ?? '',
    website: data.website ?? '',
  });

  const handleSave = useCallback(() => {
    startTransition(async () => {
      const { socio_nome, socio_qualificacao, email: editEmail, ...leadFields } = editFields;

      // Rebuild socios array with edited first socio
      let updatedSocios = data.socios ? [...data.socios] : [];
      if (socio_nome || socio_qualificacao) {
        const existingSocio = updatedSocios[0] ?? { nome: '', qualificacao: '' };
        updatedSocios[0] = {
          ...existingSocio,
          nome: socio_nome || existingSocio.nome,
          qualificacao: socio_qualificacao || existingSocio.qualificacao,
        };
      }

      // Update email on socio if it came from socios, otherwise on lead
      const emailOnSocio = (data.socios ?? []).flatMap((s) => s.emails ?? []).length > 0;
      if (emailOnSocio && updatedSocios[0]) {
        const existingEmails = updatedSocios[0].emails ?? [];
        if (existingEmails.length > 0 && existingEmails[0]) {
          existingEmails[0] = { ...existingEmails[0], email: editEmail };
        } else {
          updatedSocios[0].emails = [{ email: editEmail, ranking: 1 }];
        }
      }

      const result = await updateLead(data.id, {
        ...leadFields,
        email: emailOnSocio ? data.email : editEmail,
        socios: updatedSocios,
      });
      if (result.success) {
        toast.success('Lead atualizado');
        setIsEditing(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }, [data.id, data.email, data.socios, editFields, router]);

  const handleCancelEdit = useCallback(() => {
    setEditFields({
      razao_social: data.razao_social ?? '',
      nome_fantasia: data.nome_fantasia ?? '',
      email: primaryEmail,
      telefone: data.telefone ?? '',
      socio_nome: primarySocio?.nome ?? '',
      socio_qualificacao: primarySocio?.qualificacao ?? '',
      instagram: data.instagram ?? '',
      linkedin: data.linkedin ?? '',
      website: data.website ?? '',
    });
    setIsEditing(false);
  }, [data, primarySocio, primaryEmail]);

  const fullName = primarySocio?.nome ?? data.razao_social ?? null;
  const firstName = fullName?.split(' ')[0] ?? null;
  const companyName = data.nome_fantasia ?? data.razao_social ?? null;
  const cargo = primarySocio?.qualificacao
    || (primarySocio?.nome ? (primarySocio.nome.trim().split(/\s+/)[0]?.toLowerCase().endsWith('a') ? 'Sócia' : 'Sócio') : null);

  // Gather all phones with type
  const allPhones: Array<{ tipo: string; numero: string; href: string; whatsapp: boolean; nome?: string }> = [];
  if (data.telefone) {
    allPhones.push({ tipo: 'Fixo', numero: data.telefone, href: `tel:${data.telefone}`, whatsapp: false });
  }
  for (const socio of data.socios ?? []) {
    for (const cel of socio.celulares ?? []) {
      allPhones.push({
        tipo: 'Celular',
        numero: `(${cel.ddd}) ${cel.numero}`,
        href: `tel:+55${cel.ddd}${cel.numero}`,
        whatsapp: cel.whatsapp,
        nome: socio.nome,
      });
    }
  }

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
              *Mostrando apenas campos preenchidos.
            </p>

            {/* GERAL — contact principal */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                Geral
              </h4>
              {isEditing ? (
                <>
                  <div className="space-y-1">
                    <p className="text-xs text-[var(--muted-foreground)]">Primeiro nome</p>
                    <MeetimeFieldRow label="" value={editFields.socio_nome.split(' ')[0] || '—'} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-[var(--muted-foreground)]">Nome completo</p>
                    <Input
                      value={editFields.socio_nome}
                      onChange={(e) => setEditFields({ ...editFields, socio_nome: e.target.value })}
                      className="h-8 text-sm"
                      placeholder="Nome completo"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-[var(--muted-foreground)]">E-mail</p>
                    <Input
                      value={editFields.email}
                      onChange={(e) => setEditFields({ ...editFields, email: e.target.value })}
                      className="h-8 text-sm"
                      placeholder="email@empresa.com"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-[var(--muted-foreground)]">Empresa (Nome Fantasia)</p>
                    <Input
                      value={editFields.nome_fantasia}
                      onChange={(e) => setEditFields({ ...editFields, nome_fantasia: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-[var(--muted-foreground)]">Cargo</p>
                    <Input
                      value={editFields.socio_qualificacao}
                      onChange={(e) => setEditFields({ ...editFields, socio_qualificacao: e.target.value })}
                      className="h-8 text-sm"
                      placeholder="Cargo"
                    />
                  </div>
                </>
              ) : (
                <>
                  {firstName && <MeetimeFieldRow label="Primeiro nome" value={firstName} />}
                  {fullName && <MeetimeFieldRow label="Nome completo" value={fullName} />}
                  {primaryEmail && <MeetimeFieldRow label="E-mail" value={primaryEmail} href={`mailto:${primaryEmail}`} />}
                  {companyName && <MeetimeFieldRow label="Empresa" value={companyName} />}
                  <MeetimeFieldRow label="Cargo" value={cargo || '—'} />
                </>
              )}
            </div>

            {/* TELEFONE(S) — with type descriptor */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                Telefone(s)
              </h4>
              {isEditing && (
                <div className="space-y-1">
                  <p className="text-xs text-[var(--muted-foreground)]">Telefone da empresa</p>
                  <Input
                    value={editFields.telefone}
                    onChange={(e) => setEditFields({ ...editFields, telefone: e.target.value })}
                    className="h-8 text-sm"
                    placeholder="(11) 3000-0000"
                  />
                </div>
              )}
              {allPhones.length === 0 && !isEditing ? (
                <p className="text-xs text-[var(--muted-foreground)]">Nenhum telefone informado.</p>
              ) : (
                allPhones.map((phone, i) => (
                  <div key={`phone-${i}`} className="flex gap-2">
                    <div className="w-20 shrink-0 space-y-1">
                      <p className="text-[10px] text-[var(--muted-foreground)]">Descrição:</p>
                      <div className="rounded-md bg-[var(--muted)] px-2 py-1.5 text-xs font-medium">
                        {phone.tipo}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-[10px] text-[var(--muted-foreground)]">Telefone:</p>
                      <div className="rounded-md bg-[var(--muted)] px-3 py-1.5 text-sm">
                        <a href={phone.href} className="text-[var(--primary)] hover:underline truncate">
                          {phone.numero}
                        </a>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* SOCIAL */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                Social
              </h4>
              {isEditing ? (
                <>
                  <div className="space-y-1">
                    <p className="text-xs text-[var(--muted-foreground)]">Instagram</p>
                    <Input
                      value={editFields.instagram}
                      onChange={(e) => setEditFields({ ...editFields, instagram: e.target.value })}
                      className="h-8 text-sm"
                      placeholder="@usuario"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-[var(--muted-foreground)]">LinkedIn</p>
                    <Input
                      value={editFields.linkedin}
                      onChange={(e) => setEditFields({ ...editFields, linkedin: e.target.value })}
                      className="h-8 text-sm"
                      placeholder="https://linkedin.com/in/..."
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-[var(--muted-foreground)]">Site</p>
                    <Input
                      value={editFields.website}
                      onChange={(e) => setEditFields({ ...editFields, website: e.target.value })}
                      className="h-8 text-sm"
                      placeholder="https://..."
                    />
                  </div>
                </>
              ) : (
                <>
                  <MeetimeFieldRow label="Instagram" value={data.instagram || '—'} href={data.instagram ? `https://instagram.com/${data.instagram.replace('@', '')}` : undefined} />
                  <MeetimeFieldRow label="LinkedIn" value={data.linkedin || '—'} href={data.linkedin || undefined} />
                  <MeetimeFieldRow label="Site" value={data.website || '—'} href={data.website || undefined} />
                </>
              )}
            </div>

            {/* STATUS — metadados internos */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                Status
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

      {/* FAB — sticky, only on Dados tab */}
      {activeTab === 'dados' && (
        <div className="sticky bottom-0 flex justify-end gap-2 pt-3 pb-1 bg-[var(--background)]">
          {isEditing ? (
            <>
              <Button
                size="icon"
                variant="outline"
                className="h-10 w-10 rounded-full shadow-lg"
                onClick={handleCancelEdit}
                disabled={isPending}
              >
                <X className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="default"
                className="h-10 w-10 rounded-full shadow-lg"
                onClick={handleSave}
                disabled={isPending}
              >
                <Save className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button
              size="icon"
              variant="default"
              className="h-10 w-10 rounded-full shadow-lg"
              onClick={() => setIsEditing(true)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
