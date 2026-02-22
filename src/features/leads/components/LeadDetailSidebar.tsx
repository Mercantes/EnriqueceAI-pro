'use client';

import { Mail, MessageSquare, Phone } from 'lucide-react';

import { Badge } from '@/shared/components/ui/badge';
import { Separator } from '@/shared/components/ui/separator';

import type { LeadEnrollmentData } from '../actions/fetch-lead-enrollment';
import type { LeadRow } from '../types';
import { formatCnpj } from '../utils/cnpj';
import { LeadStatusBadge } from './LeadStatusBadge';

interface LeadDetailSidebarProps {
  lead: LeadRow;
  enrollmentData: LeadEnrollmentData;
}

export function LeadDetailSidebar({ lead, enrollmentData }: LeadDetailSidebarProps) {
  const { enrollment, kpis } = enrollmentData;

  const socioCelulares = (lead.socios ?? []).flatMap((socio) =>
    (socio.celulares ?? []).map((cel) => ({
      nome: socio.nome,
      ddd: cel.ddd,
      numero: cel.numero,
      whatsapp: cel.whatsapp,
    })),
  );
  const hasAnyPhone = !!lead.telefone || socioCelulares.length > 0;

  return (
    <div className="w-80 shrink-0 space-y-4">
      {/* KPIs */}
      <div className="rounded-lg border bg-[var(--card)] p-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-2xl font-bold">{kpis.completed}</p>
            <p className="text-[10px] font-medium text-[var(--muted-foreground)] uppercase">Completado</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{kpis.open}</p>
            <p className="text-[10px] font-medium text-[var(--muted-foreground)] uppercase">Aberto{kpis.open !== 1 ? 's' : ''}</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{kpis.conversations}</p>
            <p className="text-[10px] font-medium text-[var(--muted-foreground)] uppercase">Conversa{kpis.conversations !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>

      {/* Geral */}
      <div className="rounded-lg border bg-[var(--card)] p-4 space-y-3">
        <h3 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Geral</h3>
        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--muted-foreground)]">Status</span>
          <LeadStatusBadge status={lead.status} variant="meetime" />
        </div>
        {enrollment && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--muted-foreground)]">Cadência</span>
            <Badge variant="outline" className="text-xs">
              {enrollment.cadence_name}
            </Badge>
          </div>
        )}
        {enrollment?.enrolled_by_email && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--muted-foreground)]">Responsável</span>
            <span className="text-sm">{enrollment.enrolled_by_email.split('@')[0]}</span>
          </div>
        )}
      </div>

      {/* Dados */}
      <div className="rounded-lg border bg-[var(--card)] p-4 space-y-3">
        <h3 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Dados</h3>
        {lead.email && (
          <div className="flex items-center gap-2 text-sm">
            <Mail className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]" />
            <a href={`mailto:${lead.email}`} className="truncate text-[var(--primary)] hover:underline">
              {lead.email}
            </a>
          </div>
        )}
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--muted-foreground)]">Empresa</span>
          <span className="truncate max-w-[150px] text-right">{lead.razao_social ?? '—'}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--muted-foreground)]">CNPJ</span>
          <span className="font-mono text-xs">{formatCnpj(lead.cnpj)}</span>
        </div>
        {lead.porte && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--muted-foreground)]">Porte</span>
            <span>{lead.porte}</span>
          </div>
        )}
        {lead.situacao_cadastral && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--muted-foreground)]">Situação</span>
            <span>{lead.situacao_cadastral}</span>
          </div>
        )}
        {lead.fit_score != null && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--muted-foreground)]">Fit Score</span>
            <FitScoreBadge score={lead.fit_score} />
          </div>
        )}
      </div>

      {/* Telefone(s) */}
      <div className="rounded-lg border bg-[var(--card)] p-4 space-y-3">
        <h3 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Telefone(s)</h3>
        <Separator />
        {hasAnyPhone ? (
          <div className="space-y-2">
            {lead.telefone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]" />
                <a href={`tel:${lead.telefone}`} className="text-[var(--primary)] hover:underline">
                  {lead.telefone}
                </a>
                <span className="text-xs text-[var(--muted-foreground)]">Empresa</span>
              </div>
            )}
            {socioCelulares.map((cel, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <Phone className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]" />
                <a
                  href={`tel:+55${cel.ddd}${cel.numero}`}
                  className="text-[var(--primary)] hover:underline"
                >
                  ({cel.ddd}) {cel.numero}
                </a>
                {cel.whatsapp && (
                  <Badge variant="outline" className="h-5 border-green-500 text-green-600 text-[10px]">
                    <MessageSquare className="mr-0.5 h-2.5 w-2.5" />
                    WhatsApp
                  </Badge>
                )}
                <span className="text-xs text-[var(--muted-foreground)] truncate">{cel.nome}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--muted-foreground)]">Nenhum telefone cadastrado</p>
        )}
      </div>
    </div>
  );
}

function FitScoreBadge({ score }: { score: number }) {
  const color =
    score >= 70
      ? 'bg-green-100 text-green-700'
      : score >= 40
        ? 'bg-yellow-100 text-yellow-700'
        : 'bg-red-100 text-red-700';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>
      {score}
    </span>
  );
}
