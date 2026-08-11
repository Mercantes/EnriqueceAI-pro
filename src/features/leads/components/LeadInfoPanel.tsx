'use client';

import { useCallback, useContext, useEffect, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  CalendarDays,
  ChevronDown,
  Clock,
  FileText,
  Pencil,
  Plus,
  Save,
  Sparkles,
  User,
  X,
} from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';

import type { TimelineEntry } from '@/features/cadences/cadences.contract';
import type { CustomFieldRow } from '@/features/settings-prospecting/types/custom-field';
import type { StandardFieldSettingRow } from '@/features/settings-prospecting/actions/standard-field-settings';
import { STANDARD_FIELDS } from '@/features/settings-prospecting/constants/standard-fields';
import { OrgContext } from '@/features/auth/components/OrganizationProvider';

import { formatDateOnly, formatDateTimeBR } from '@/lib/utils/format';

import type { LeadSourceOption } from '../actions/get-lead-source-options';
import { LEAD_SOURCE_OPTIONS, SEGMENTO_OPTIONS } from '../schemas/lead.schemas';
import { getCanalOptions } from '../utils/canal-options';
import { updateLead } from '../actions/update-lead';

import { CurrencyInput, formatBRL } from './CurrencyInput';
import { LeadNotes } from './LeadNotes';
import { InlineEditField } from './InlineEditField';
import { MeetimeFieldRow } from './MeetimeFieldRow';
import type { LeadInfoPanelData } from './lead-info-panel.utils';
import { LeadInfoPanelHeader } from './LeadInfoPanelHeader';
import { LeadContactsSection, type PrimaryContactMirror } from './LeadContactsSection';
import { LeadTimelineTab } from './LeadTimelineTab';
import { LeadActivityTab } from './LeadActivityTab';
import { LeadScheduleTab } from './LeadScheduleTab';
import { GenerateBantDialog } from './GenerateBantDialog';

/**
 * Fallback de Cargo: quando o surface que renderiza este painel não passa
 * `jobTitleOptions` (ex.: painel do lead dentro da execução de atividade), o
 * dropdown ficava vazio. Usa os defaults do STANDARD_FIELDS — mesma fonte da
 * tela de Ajustes > Prospecção e do getJobTitleOptions — espelhando o fallback
 * que a Origem (lead_source) já tem.
 */
const DEFAULT_JOB_TITLE_OPTIONS: { value: string; label: string }[] = (
  STANDARD_FIELDS.find((f) => f.key === 'job_title')?.defaultOptions ?? []
).map((label) => ({ value: label, label }));

/**
 * Build a clickable Instagram URL from stored value.
 * Accepts: "https://instagram.com/foo", "instagram.com/foo", "@foo", "foo".
 * Legacy leads stored "@username" — keep them clickable while new ones save full URL.
 */
function normalizeInstagramUrl(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^(www\.)?instagram\.com\//i.test(trimmed)) return `https://${trimmed.replace(/^www\./i, '')}`;
  const handle = trimmed.replace(/^@/, '').replace(/\s+/g, '');
  if (!handle) return undefined;
  return `https://instagram.com/${handle}`;
}

/** Prefix bare hostnames with https:// so href stays clickable. */
function normalizeUrlMaybe(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function CollapsibleSection({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between group"
      >
        <h4 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted-foreground)] dark:text-[var(--foreground)]">
          {title}
        </h4>
        <ChevronDown className={`h-3.5 w-3.5 text-[var(--muted-foreground)] transition-transform ${isOpen ? '' : '-rotate-90'}`} />
      </button>
      {isOpen && children}
    </div>
  );
}

// Salvaguarda dos dropdowns de edição: o valor salvo do lead vem de
// enriquecimento/import/IA e muitas vezes NÃO está na lista curada de opções.
// Sem isto, o Radix Select mostra o placeholder (parece vazio) mesmo com o valor
// salvo — o que confundia e arriscava sobrescrita (ex.: Segmento "Imobiliária"
// não estava em SEGMENTO_OPTIONS). Injeta o valor atual como opção quando falta.
function withCurrentString(options: readonly string[], current?: string | null): readonly string[] {
  return current && !options.includes(current) ? [current, ...options] : options;
}
function withCurrentOption(
  options: readonly { value: string; label: string }[],
  current?: string | null,
): readonly { value: string; label: string }[] {
  return current && !options.some((o) => o.value === current)
    ? [{ value: current, label: current }, ...options]
    : options;
}

export interface LeadInfoPanelProps {
  data: LeadInfoPanelData;
  enrollment?: { cadence_name: string; enrolled_by_email: string | null } | null;
  enrollments?: Array<{ cadence_name: string; enrolled_by_email: string | null }>;
  timeline?: TimelineEntry[];
  showLeadHeader?: boolean;
  cadenceConfig?: { cadenceName: string; stepOrder: number; totalSteps: number };
  kpis?: { completed: number; open: number; conversations: number };
  customFieldDefs?: CustomFieldRow[];
  leadSourceOptions?: LeadSourceOption[];
  jobTitleOptions?: { value: string; label: string }[];
  standardFieldSettings?: StandardFieldSettingRow[];
}

type TabId = 'dados' | 'timeline' | 'notas' | 'agendar' | 'atividade';

export function LeadInfoPanel({
  data: initialData,
  enrollment: _enrollment,
  enrollments: _enrollments,
  timeline,
  showLeadHeader = false,
  cadenceConfig: _cadenceConfig,
  kpis,
  customFieldDefs,
  leadSourceOptions,
  jobTitleOptions,
  standardFieldSettings,
}: LeadInfoPanelProps) {
  const [isPending, startTransition] = useTransition();
  const sourceOptions = leadSourceOptions ?? LEAD_SOURCE_OPTIONS.map((o) => ({ value: o.value, label: o.label }));
  const cargoOptions = jobTitleOptions && jobTitleOptions.length > 0 ? jobTitleOptions : DEFAULT_JOB_TITLE_OPTIONS;

  const orgContext = useContext(OrgContext);
  const members = orgContext?.members ?? [];

  const isFieldVisible = useCallback((key: string) => {
    if (!standardFieldSettings || standardFieldSettings.length === 0) return true;
    const setting = standardFieldSettings.find((s) => s.field_key === key);
    return setting?.is_visible ?? true;
  }, [standardFieldSettings]);

  const assignedMember = initialData.assigned_to
    ? members.find((m) => m.user_id === initialData.assigned_to)
    : null;
  const assignedMemberName = assignedMember?.name
    ?? (initialData.assigned_to ? initialData.assigned_to.slice(0, 8) : null);

  // Local state for lead data — survives router.refresh() in activity execution context
  const [data, setData] = useState(initialData);
  const [trackedLeadId, setTrackedLeadId] = useState(initialData.id);

  // Re-initialize when showing a different lead
  if (initialData.id !== trackedLeadId) {
    setData(initialData);
    setTrackedLeadId(initialData.id);
  }

  const availableTabs: { id: TabId; icon: typeof User; label: string }[] = [
    { id: 'dados', icon: User, label: 'Dados' },
    { id: 'timeline', icon: Clock, label: 'Timeline' },
    { id: 'notas', icon: FileText, label: 'Notas' },
    { id: 'agendar', icon: CalendarDays, label: 'Reunião' },
    { id: 'atividade', icon: Plus, label: 'Atividade' },
  ];

  const [activeTab, setActiveTab] = useState<TabId>('dados');
  const [isEditing, setIsEditing] = useState(false);
  // Snapshot of the form state captured when editing starts, so on save we
  // send ONLY the fields the user actually changed. Without this the form
  // submits every field (pre-filled from socio/razao_social fallbacks), and
  // the lead timeline logs all of them as "changed" instead of just the edit.
  const editSnapshotRef = useRef<{
    editFields: Record<string, string>;
    customFieldValues: Record<string, string>;
  } | null>(null);
  const [isBantDialogOpen, setIsBantDialogOpen] = useState(false);

  // Detect if org has any BANT-style custom fields configured
  const hasBantFields = (customFieldDefs ?? []).some((cf) =>
    /^(B|A|N|T)\s*\(/.test(cf.field_name) ||
    cf.field_name === 'Oportunidades' ||
    cf.field_name === 'Gaps da ligação' ||
    cf.field_name === 'Observação Decisor',
  );

  // Primary contact (first socio)
  const primarySocio = data.socios?.[0] ?? null;

  const primaryEmail = (data.socios ?? []).flatMap((s) => s.emails ?? []).sort((a, b) => a.ranking - b.ranking)[0]?.email ?? data.email ?? '';

  const [editFields, setEditFields] = useState({
    first_name: data.first_name ?? primarySocio?.nome?.split(' ')[0] ?? '',
    last_name: data.last_name ?? (primarySocio?.nome?.split(' ').slice(1).join(' ') ?? ''),
    nome_fantasia: data.nome_fantasia ?? data.razao_social ?? '',
    email: primaryEmail,
    job_title: data.job_title ?? primarySocio?.qualificacao ?? '',
    lead_source: data.lead_source ?? '',
    canal: data.canal ?? '',
    segmento: data.segmento ?? '',
    cnpj: data.cnpj ?? '',
    instagram: data.instagram ?? '',
    linkedin: data.linkedin ?? '',
    website: data.website ?? '',
  });

  const [editCustomFieldValues, setEditCustomFieldValues] = useState<Record<string, string>>(
    data.custom_field_values ?? {},
  );

  // Reset all edit state when lead changes
  useEffect(() => {
    setIsEditing(false);
    setActiveTab('dados');
    const socio = data.socios?.[0] ?? null;
    const email = (data.socios ?? []).flatMap((s) => s.emails ?? []).sort((a, b) => a.ranking - b.ranking)[0]?.email ?? data.email ?? '';
    setEditFields({
      first_name: data.first_name ?? socio?.nome?.split(' ')[0] ?? '',
      last_name: data.last_name ?? (socio?.nome?.split(' ').slice(1).join(' ') ?? ''),
      nome_fantasia: data.nome_fantasia ?? data.razao_social ?? '',
      email,
      job_title: data.job_title ?? socio?.qualificacao ?? '',
      lead_source: data.lead_source ?? '',
      canal: data.canal ?? '',
      segmento: data.segmento ?? '',
      cnpj: data.cnpj ?? '',
      instagram: data.instagram ?? '',
      linkedin: data.linkedin ?? '',
      website: data.website ?? '',
    });
    setEditCustomFieldValues(data.custom_field_values ?? {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackedLeadId]);

  // Contatos (nome, cargo, telefones, e-mails) agora vivem em LeadContactsSection,
  // gravados na tabela lead_contacts. O contato principal é espelhado de volta
  // nas colunas do lead por trigger no banco. Quando ele muda, atualizamos o
  // estado local aqui para o cabeçalho/discador refletirem o novo principal.
  const handlePrimaryContactChange = useCallback((mirror: PrimaryContactMirror) => {
    setData((prev) => ({
      ...prev,
      first_name: mirror.first_name,
      last_name: mirror.last_name,
      job_title: mirror.job_title,
      email: mirror.email,
      emails: mirror.emails,
      telefone: mirror.telefone,
      phones: mirror.phones,
    }));
    setEditFields((prev) => ({
      ...prev,
      first_name: mirror.first_name ?? '',
      last_name: mirror.last_name ?? '',
      job_title: mirror.job_title ?? '',
    }));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('lead:updated', { detail: { leadId: data.id } }));
    }
  }, [data.id]);

  const handleStartEdit = useCallback(() => {
    // Capture the baseline the form shows now, so save can diff against it.
    editSnapshotRef.current = {
      editFields: { ...editFields },
      customFieldValues: { ...editCustomFieldValues },
    };
    setIsEditing(true);
  }, [editFields, editCustomFieldValues]);

  const handleSave = useCallback(() => {
    startTransition(async () => {
      // Nome/cargo/telefones/e-mails do contato não são gravados aqui — pertencem
      // a lead_contacts (seção Contatos). Removidos do payload da empresa.
      const { email: _editEmail, first_name: _fn, last_name: _ln, job_title: _jt, ...leadFields } = editFields;

      // Remove empty cnpj/canal/segmento to avoid check constraint violations
      const cleanFields: Record<string, unknown> = { ...leadFields };
      if (!(cleanFields.cnpj as string)?.trim()) delete cleanFields.cnpj;
      if (!(cleanFields.canal as string)?.trim()) delete cleanFields.canal;
      if (!(cleanFields.segmento as string)?.trim()) delete cleanFields.segmento;

      // Send ONLY the fields the user actually changed, diffing against the
      // snapshot taken when editing started. Avoids submitting pre-filled
      // fallback values (socio name, razao_social) that were never touched,
      // which would otherwise show up as bogus entries in the lead timeline.
      const snap = editSnapshotRef.current;
      const same = (a: unknown, b: unknown) =>
        (typeof a === 'string' ? a.trim() : a ?? '') === (typeof b === 'string' ? b.trim() : b ?? '');

      const updatePayload: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(cleanFields)) {
        if (!snap || !same(val, snap.editFields[key])) updatePayload[key] = val;
      }

      const customChanged = !snap || JSON.stringify(editCustomFieldValues) !== JSON.stringify(snap.customFieldValues);
      if (customChanged) {
        updatePayload.custom_field_values = editCustomFieldValues;
      }

      // Nothing actually changed — close edit mode without a no-op write.
      if (Object.keys(updatePayload).length === 0) {
        setIsEditing(false);
        return;
      }

      const result = await updateLead(data.id, updatePayload);
      if (result.success) {
        setData((prev) => ({
          ...prev,
          nome_fantasia: editFields.nome_fantasia || null,
          lead_source: editFields.lead_source || null,
          canal: editFields.canal || null,
          segmento: editFields.segmento || null,
          cnpj: editFields.cnpj || null,
          instagram: editFields.instagram || null,
          linkedin: editFields.linkedin || null,
          website: editFields.website || null,
          custom_field_values: editCustomFieldValues,
        }));
        toast.success('Lead atualizado');
        setIsEditing(false);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('lead:updated', { detail: { leadId: data.id } }));
        }
      } else {
        toast.error(result.error);
      }
    });
  }, [data.id, editFields, editCustomFieldValues]);

  const handleCancelEdit = useCallback(() => {
    setEditFields({
      first_name: data.first_name ?? primarySocio?.nome?.split(' ')[0] ?? '',
      last_name: data.last_name ?? (primarySocio?.nome?.split(' ').slice(1).join(' ') ?? ''),
      nome_fantasia: data.nome_fantasia ?? '',
      email: primaryEmail,
      job_title: data.job_title ?? primarySocio?.qualificacao ?? '',
      lead_source: data.lead_source ?? '',
      canal: data.canal ?? '',
      segmento: data.segmento ?? '',
      cnpj: data.cnpj ?? '',
      instagram: data.instagram ?? '',
      linkedin: data.linkedin ?? '',
      website: data.website ?? '',
    });
    setEditCustomFieldValues(data.custom_field_values ?? {});
    setIsEditing(false);
  }, [data, primarySocio, primaryEmail]);

  const contactFullName = data.first_name ? `${data.first_name} ${data.last_name ?? ''}`.trim() : null;
  const fullName = contactFullName ?? primarySocio?.nome ?? data.razao_social ?? null;
  const firstName = data.first_name ?? fullName?.split(' ')[0] ?? null;
  const companyName = data.nome_fantasia ?? data.razao_social ?? null;
  const _cargo = data.job_title
    || primarySocio?.qualificacao
    || (primarySocio?.nome ? (primarySocio.nome.trim().split(/\s+/)[0]?.toLowerCase().endsWith('a') ? 'Sócia' : 'Sócio') : null);

  const avatarInitial = (firstName ?? companyName ?? data.cnpj ?? '?')[0]?.toUpperCase() ?? '?';
  const headerName = fullName ?? companyName ?? data.cnpj ?? '—';
  const headerCompany = fullName && companyName && fullName !== companyName ? companyName : null;

  // Agrupa os 4 campos de BANT (B/A/N/T) numa subseção recolhível "Qualificação
  // (BANT)", fechada por padrão — em vez de 4 linhas soltas. O contador mostra
  // quantos estão preenchidos sem precisar abrir. Os demais campos seguem soltos.
  const bantRegex = /^(B|A|N|T)\s*\(/;
  // "Biblioteca de anúncios" (Google/Meta) são custom fields, mas conceitualmente
  // são links sociais — movidos para a seção Social (junto de Site/Instagram).
  const BIBLIOTECA_NAMES = new Set(['Biblioteca Google', 'Biblioteca Meta']);
  const bantDefs = (customFieldDefs ?? []).filter((cf) => bantRegex.test(cf.field_name));
  const bibliotecaDefs = (customFieldDefs ?? []).filter((cf) => BIBLIOTECA_NAMES.has(cf.field_name));
  const restCustomDefs = (customFieldDefs ?? []).filter(
    (cf) => !bantRegex.test(cf.field_name) && !BIBLIOTECA_NAMES.has(cf.field_name),
  );
  const bantFilledCount = bantDefs.filter((cf) => {
    const v = data.custom_field_values?.[cf.id];
    return v != null && String(v).trim() !== '';
  }).length;

  const renderEditCustomField = (cf: CustomFieldRow) => (
    <div key={cf.id} className="space-y-1">
      <p className="text-xs text-[var(--muted-foreground)] dark:text-[var(--foreground)]">{cf.field_name}</p>
      {cf.field_type === 'select' && cf.options && cf.options.length > 0 ? (
        <Select
          value={editCustomFieldValues[cf.id] ?? 'none'}
          onValueChange={(v) =>
            setEditCustomFieldValues((prev) => ({ ...prev, [cf.id]: v === 'none' ? '' : v }))
          }
        >
          <SelectTrigger className="w-full text-sm">
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">—</SelectItem>
            {withCurrentString(cf.options, editCustomFieldValues[cf.id]).map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : cf.field_type === 'textarea' || cf.field_type === 'text' ? (
        <textarea
          value={editCustomFieldValues[cf.id] ?? ''}
          onChange={(e) =>
            setEditCustomFieldValues((prev) => ({ ...prev, [cf.id]: e.target.value }))
          }
          rows={1}
          className={`w-full rounded-md border bg-transparent px-3 py-2 text-sm placeholder:text-[var(--muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] resize-y field-sizing-content ${cf.field_type === 'textarea' ? 'min-h-[80px]' : 'min-h-[40px]'}`}
          placeholder={cf.field_name}
        />
      ) : cf.field_type === 'currency' ? (
        <CurrencyInput
          value={editCustomFieldValues[cf.id] ?? ''}
          onChange={(raw) =>
            setEditCustomFieldValues((prev) => ({ ...prev, [cf.id]: raw }))
          }
          placeholder={cf.field_name}
          className="h-8 text-sm"
        />
      ) : (
        <Input
          value={editCustomFieldValues[cf.id] ?? ''}
          onChange={(e) =>
            setEditCustomFieldValues((prev) => ({ ...prev, [cf.id]: e.target.value }))
          }
          className="h-8 text-sm"
          type={cf.field_type === 'number' ? 'number' : cf.field_type === 'date' ? 'date' : cf.field_type === 'datetime' ? 'datetime-local' : cf.field_type === 'url' ? 'url' : 'text'}
          placeholder={cf.field_type === 'url' ? 'https://...' : cf.field_name}
        />
      )}
    </div>
  );

  const renderDisplayCustomField = (cf: CustomFieldRow) => {
    const rawVal = data.custom_field_values?.[cf.id];
    let display: string;
    if (cf.field_type === 'currency') {
      display = formatBRL(rawVal);
    } else if (cf.field_type === 'date') {
      display = rawVal ? formatDateOnly(rawVal) : '—';
    } else if (cf.field_type === 'datetime') {
      display = rawVal ? formatDateTimeBR(rawVal) : '—';
    } else {
      display = rawVal || '—';
    }
    return (
      <MeetimeFieldRow
        key={cf.id}
        label={cf.field_name}
        value={display}
        multiline={cf.field_type === 'textarea' || cf.field_type === 'text'}
        href={cf.field_type === 'url' && rawVal ? (rawVal.startsWith('http://') || rawVal.startsWith('https://') ? rawVal : `https://${rawVal}`) : undefined}
      />
    );
  };

  return (
    <div className={`flex h-full shrink-0 flex-col ${showLeadHeader ? 'w-full' : 'w-96'}`}>
      {/* Lead header — avatar + name + actions shown only in activity execution */}
      {showLeadHeader && (
        <LeadInfoPanelHeader
          leadId={data.id}
          avatarInitial={avatarInitial}
          headerName={headerName}
          headerCompany={headerCompany}
          fitScore={data.fit_score}
          engagementScore={data.engagement_score}
          timeline={timeline}
          onNavigateToTimeline={() => setActiveTab('timeline')}
        />
      )}

      {/* KPIs */}
      {kpis && (
        <div className="mb-4 rounded-lg border bg-[var(--card)] p-3">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-2xl font-bold">{kpis.completed}</p>
              <p className="text-xs font-medium uppercase text-[var(--muted-foreground)] dark:text-[var(--foreground)]">
                Completado
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold">{kpis.open}</p>
              <p className="text-xs font-medium uppercase text-[var(--muted-foreground)] dark:text-[var(--foreground)]">
                Aberto{kpis.open !== 1 ? 's' : ''}
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold">{kpis.conversations}</p>
              <p className="text-xs font-medium uppercase text-[var(--muted-foreground)] dark:text-[var(--foreground)]">
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
                        : 'border-transparent text-[var(--muted-foreground)] dark:text-[var(--foreground)] hover:text-[var(--foreground)]'
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
      <div className="flex-1 overflow-y-auto pr-1">
        {/* Tab Dados */}
        {activeTab === 'dados' && (
          <div className="space-y-4">

            {/* GERAL — contact principal */}
            <CollapsibleSection title="Geral">
              {isEditing ? (
                <>
                  {/* Nome, sobrenome e cargo do contato agora são editados na
                      seção "Contatos" (card do contato principal). Aqui ficam
                      apenas os dados da empresa. */}
                  {isFieldVisible('nome_fantasia') && (
                    <div className="space-y-1">
                      <p className="text-xs text-[var(--muted-foreground)] dark:text-[var(--foreground)]">Empresa</p>
                      <Input
                        value={editFields.nome_fantasia}
                        onChange={(e) => setEditFields({ ...editFields, nome_fantasia: e.target.value })}
                        className="h-8 text-sm"
                      />
                    </div>
                  )}
                  {isFieldVisible('lead_source') && (
                    <div className="space-y-1">
                      <p className="text-xs text-[var(--muted-foreground)] dark:text-[var(--foreground)]">Origem</p>
                      <Select
                        value={editFields.lead_source ?? 'none'}
                        onValueChange={(value) => {
                          setEditFields((prev) => ({ ...prev, lead_source: value === 'none' ? '' : value }));
                        }}
                      >
                        <SelectTrigger className="w-full text-sm">
                          <SelectValue placeholder="Selecione a origem" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">—</SelectItem>
                          {withCurrentOption(sourceOptions, editFields.lead_source).map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {isFieldVisible('canal') && (
                    <div className="space-y-1">
                      <p className="text-xs text-[var(--muted-foreground)] dark:text-[var(--foreground)]">Sub-origem</p>
                      <Select
                        value={editFields.canal ?? 'none'}
                        onValueChange={(value) => {
                          setEditFields((prev) => ({ ...prev, canal: value === 'none' ? '' : value }));
                        }}
                      >
                        <SelectTrigger className="w-full text-sm">
                          <SelectValue placeholder="Selecione o canal" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">—</SelectItem>
                          {withCurrentString(getCanalOptions(standardFieldSettings), editFields.canal).map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {isFieldVisible('segmento') && (
                    <div className="space-y-1">
                      <p className="text-xs text-[var(--muted-foreground)] dark:text-[var(--foreground)]">Segmento</p>
                      <Select
                        value={editFields.segmento ?? 'none'}
                        onValueChange={(value) => {
                          setEditFields((prev) => ({ ...prev, segmento: value === 'none' ? '' : value }));
                        }}
                      >
                        <SelectTrigger className="w-full text-sm">
                          <SelectValue placeholder="Selecione o segmento" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">—</SelectItem>
                          {withCurrentString(
                            standardFieldSettings?.find((s) => s.field_key === 'segmento')?.options ?? SEGMENTO_OPTIONS,
                            editFields.segmento,
                          ).map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {isFieldVisible('cnpj') && (
                    <div className="space-y-1">
                      <p className="text-xs text-[var(--muted-foreground)] dark:text-[var(--foreground)]">CNPJ</p>
                      <Input
                        value={editFields.cnpj ?? ''}
                        onChange={(e) => setEditFields({ ...editFields, cnpj: e.target.value })}
                        className="h-8 text-sm"
                        placeholder="00.000.000/0000-00"
                      />
                    </div>
                  )}
                </>
              ) : (
                <>
                  {isFieldVisible('first_name') && firstName && <MeetimeFieldRow label="Primeiro nome" value={firstName} />}
                  {isFieldVisible('last_name') && (data.last_name ? (
                    <MeetimeFieldRow label="Sobrenome" value={data.last_name} />
                  ) : fullName && fullName !== firstName ? (
                    <MeetimeFieldRow label="Nome completo" value={fullName} />
                  ) : null)}
                  {/* Email is shown in the E-MAIL(S) section below */}
                  {isFieldVisible('nome_fantasia') && (
                    <InlineEditField
                      leadId={data.id}
                      fieldKey="nome_fantasia"
                      label="Empresa"
                      value={data.nome_fantasia ?? data.razao_social}
                      placeholder="Adicionar empresa"
                      onSaved={(v) => {
                        setData((prev) => ({ ...prev, nome_fantasia: v || null }));
                        setEditFields((prev) => ({ ...prev, nome_fantasia: v ?? '' }));
                      }}
                    />
                  )}
                  {/* Cargo is a managed dropdown (Ajustes > Prospecção) — show it
                      read-only here like the other dropdown fields (Origem,
                      Sub-origem, Segmento) so it can only be set by selecting a
                      predefined option in edit mode, never free-typed. */}
                  {isFieldVisible('job_title') && (
                    <MeetimeFieldRow
                      label="Cargo"
                      value={cargoOptions.find((o) => o.value === data.job_title)?.label ?? data.job_title ?? '—'}
                    />
                  )}
                  {isFieldVisible('lead_source') && (
                    <MeetimeFieldRow
                      label="Origem"
                      value={sourceOptions.find((o) => o.value === data.lead_source)?.label ?? data.lead_source ?? '—'}
                    />
                  )}
                  {isFieldVisible('canal') && <MeetimeFieldRow label="Sub-origem" value={data.canal || '—'} />}
                  {isFieldVisible('segmento') && <MeetimeFieldRow label="Segmento" value={data.segmento || '—'} />}
                  {isFieldVisible('cnpj') && <MeetimeFieldRow label="CNPJ" value={data.cnpj || '—'} />}
                  {isFieldVisible('assigned_to') && <MeetimeFieldRow label="SDR Responsável" value={assignedMemberName || '—'} />}
                  {isFieldVisible('created_at') && (
                    <MeetimeFieldRow
                      label="Data de Inscrição"
                      value={data.created_at ? new Date(data.created_at).toLocaleDateString('pt-BR') : '—'}
                    />
                  )}
                </>
              )}
            </CollapsibleSection>

            {isFieldVisible('telefone') && (
            <>
            <hr className="border-t-2 border-[var(--border)]" />

            <CollapsibleSection title="Contatos">
              <LeadContactsSection
                leadId={data.id}
                socios={data.socios}
                onPrimaryChange={handlePrimaryContactChange}
              />
            </CollapsibleSection>
            </>
            )}

            {/* SOCIAL */}
            {(isFieldVisible('instagram') || isFieldVisible('linkedin') || isFieldVisible('website') || bibliotecaDefs.length > 0) && (
            <>
            <hr className="border-t-2 border-[var(--border)]" />
            <CollapsibleSection title="Social">
              {isEditing ? (
                <>
                  {isFieldVisible('instagram') && (
                    <div className="space-y-1">
                      <p className="text-xs text-[var(--muted-foreground)] dark:text-[var(--foreground)]">Instagram</p>
                      <Input
                        value={editFields.instagram}
                        onChange={(e) => setEditFields({ ...editFields, instagram: e.target.value })}
                        className="h-8 text-sm"
                        placeholder="https://instagram.com/usuario"
                      />
                    </div>
                  )}
                  {isFieldVisible('linkedin') && (
                    <div className="space-y-1">
                      <p className="text-xs text-[var(--muted-foreground)] dark:text-[var(--foreground)]">LinkedIn</p>
                      <Input
                        value={editFields.linkedin}
                        onChange={(e) => setEditFields({ ...editFields, linkedin: e.target.value })}
                        className="h-8 text-sm"
                        placeholder="https://linkedin.com/in/..."
                      />
                    </div>
                  )}
                  {isFieldVisible('website') && (
                    <div className="space-y-1">
                      <p className="text-xs text-[var(--muted-foreground)] dark:text-[var(--foreground)]">Site</p>
                      <Input
                        value={editFields.website}
                        onChange={(e) => setEditFields({ ...editFields, website: e.target.value })}
                        className="h-8 text-sm"
                        placeholder="https://..."
                      />
                    </div>
                  )}
                  {bibliotecaDefs.map(renderEditCustomField)}
                </>
              ) : (
                <>
                  {isFieldVisible('instagram') && <MeetimeFieldRow label="Instagram" value={data.instagram || '—'} href={normalizeInstagramUrl(data.instagram)} />}
                  {isFieldVisible('linkedin') && <MeetimeFieldRow label="LinkedIn" value={data.linkedin || '—'} href={normalizeUrlMaybe(data.linkedin)} />}
                  {isFieldVisible('website') && <MeetimeFieldRow label="Site" value={data.website || '—'} href={normalizeUrlMaybe(data.website)} />}
                  {bibliotecaDefs.map(renderDisplayCustomField)}
                </>
              )}
            </CollapsibleSection>
            </>
            )}

            {/* CUSTOM FIELDS */}
            {customFieldDefs && customFieldDefs.length > 0 && (
              <>
                <hr className="border-t-2 border-[var(--border)]" />
                <CollapsibleSection title="Campos personalizados">
                  {hasBantFields && !isEditing && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsBantDialogOpen(true)}
                      className="w-full justify-center gap-2 border-red-200 bg-red-50/50 text-red-700 hover:bg-red-100 hover:text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Gerar BANT via IA
                    </Button>
                  )}
                  {isEditing ? (
                    <>
                      {restCustomDefs.map(renderEditCustomField)}
                      {bantDefs.length > 0 && (
                        <CollapsibleSection
                          title={`Qualificação (BANT) · ${bantFilledCount}/${bantDefs.length}`}
                          defaultOpen={false}
                        >
                          {bantDefs.map(renderEditCustomField)}
                        </CollapsibleSection>
                      )}
                    </>
                  ) : (
                    <>
                      {restCustomDefs.map(renderDisplayCustomField)}
                      {bantDefs.length > 0 && (
                        <CollapsibleSection
                          title={`Qualificação (BANT) · ${bantFilledCount}/${bantDefs.length}`}
                          defaultOpen={false}
                        >
                          {bantDefs.map(renderDisplayCustomField)}
                        </CollapsibleSection>
                      )}
                    </>
                  )}
                </CollapsibleSection>
              </>
            )}
          </div>
        )}

        {/* Tab Timeline */}
        {activeTab === 'timeline' && <LeadTimelineTab timeline={timeline} />}

        {/* Tab Notas */}
        {activeTab === 'notas' && (
          <LeadNotes leadId={data.id} notes={null} />
        )}

        {/* Tab Agendar Reunião */}
        {activeTab === 'agendar' && (
          <LeadScheduleTab
            leadId={data.id}
            leadEmail={data.email}
            companyName={data.nome_fantasia ?? data.razao_social}
          />
        )}

        {/* Tab Agendar Atividade */}
        {activeTab === 'atividade' && (
          <LeadActivityTab leadId={data.id} />
        )}
      </div>

      {/* FAB — sticky, only on Dados tab */}
      {activeTab === 'dados' && (
        <div className="sticky bottom-0 flex justify-end gap-2 pt-3 pb-1 pointer-events-none [&>*]:pointer-events-auto">
          {isEditing ? (
            <>
              <Button
                size="icon"
                variant="outline"
                aria-label="Cancelar edição"
                className="h-10 w-10 rounded-full shadow-lg"
                onClick={handleCancelEdit}
                disabled={isPending}
              >
                <X className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="default"
                aria-label="Salvar alterações"
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
              aria-label="Editar lead"
              className="h-10 w-10 rounded-full shadow-lg"
              onClick={handleStartEdit}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      <GenerateBantDialog
        open={isBantDialogOpen}
        onOpenChange={setIsBantDialogOpen}
        leadId={data.id}
      />
    </div>
  );
}
