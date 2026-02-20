'use client';

import { useCallback, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Archive,
  Building2,
  Calendar,
  Clock,
  Edit2,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Sparkles,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Separator } from '@/shared/components/ui/separator';

import type { TimelineEntry } from '@/features/cadences/cadences.contract';
import { LeadTimeline } from '@/features/cadences/components/LeadTimeline';

import { AIMessageGenerator } from '@/features/ai/components/AIMessageGenerator';
import type { LeadContext } from '@/features/ai/types';
import { ScheduleMeetingModal } from '@/features/integrations/components/ScheduleMeetingModal';

import { enrichLeadAction } from '../actions/enrich-lead';
import { archiveLead, updateLead } from '../actions/update-lead';
import type { LeadRow } from '../types';
import { formatCnpj } from '../utils/cnpj';
import { EnrichmentStatusBadge, LeadStatusBadge } from './LeadStatusBadge';

interface LeadProfileProps {
  lead: LeadRow;
  timeline?: TimelineEntry[];
}

export function LeadProfile({ lead, timeline = [] }: LeadProfileProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [editData, setEditData] = useState({
    razao_social: lead.razao_social ?? '',
    nome_fantasia: lead.nome_fantasia ?? '',
    email: lead.email ?? '',
    telefone: lead.telefone ?? '',
  });

  const handleEnrich = useCallback(() => {
    startTransition(async () => {
      const result = await enrichLeadAction(lead.id);
      if (result.success) {
        toast.success('Lead enriquecido com sucesso');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }, [lead.id, router]);

  const handleArchive = useCallback(() => {
    startTransition(async () => {
      const result = await archiveLead(lead.id);
      if (result.success) {
        toast.success('Lead arquivado');
        router.push('/leads');
      } else {
        toast.error(result.error);
      }
    });
    setShowArchiveDialog(false);
  }, [lead.id, router]);

  const handleEdit = useCallback(() => {
    startTransition(async () => {
      const result = await updateLead(lead.id, editData);
      if (result.success) {
        toast.success('Lead atualizado');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
    setShowEditDialog(false);
  }, [lead.id, editData, router]);

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
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {lead.nome_fantasia ?? lead.razao_social ?? formatCnpj(lead.cnpj)}
          </h1>
          {lead.nome_fantasia && lead.razao_social && (
            <p className="text-[var(--muted-foreground)]">{lead.razao_social}</p>
          )}
          <div className="mt-2 flex items-center gap-2">
            <LeadStatusBadge status={lead.status} />
            <EnrichmentStatusBadge status={lead.enrichment_status} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => setShowAIGenerator(true)}
          >
            <Sparkles className="mr-1 h-4 w-4" />
            Gerar com IA
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMeetingModal(true)}
          >
            <Calendar className="mr-1 h-4 w-4" />
            Agendar Reunião
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleEnrich}
            disabled={isPending || lead.enrichment_status === 'enriching'}
          >
            <RefreshCw className="mr-1 h-4 w-4" />
            Re-enriquecer
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowEditDialog(true)}
            disabled={isPending}
          >
            <Edit2 className="mr-1 h-4 w-4" />
            Editar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowArchiveDialog(true)}
            disabled={isPending || lead.status === 'archived'}
          >
            <Archive className="mr-1 h-4 w-4" />
            Arquivar
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
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
                <a href={`mailto:${lead.email}`} className="text-blue-600 hover:underline dark:text-blue-400">
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
                <div className="space-y-2">
                  {lead.socios.map((socio, i) => (
                    <div key={i} className="text-sm">
                      <span className="font-medium">{socio.nome}</span>
                      {socio.qualificacao && (
                        <span className="text-[var(--muted-foreground)]"> — {socio.qualificacao}</span>
                      )}
                      {socio.cpf_masked && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          CPF: {socio.cpf_masked}
                        </Badge>
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
            <DateRow
              icon={Calendar}
              label="Importado em"
              value={lead.created_at}
            />
            <DateRow
              icon={Calendar}
              label="Atualizado em"
              value={lead.updated_at}
            />
            {lead.enriched_at && (
              <DateRow
                icon={RefreshCw}
                label="Enriquecido em"
                value={lead.enriched_at}
              />
            )}
          </CardContent>
        </Card>

        <LeadTimeline entries={timeline} />
      </div>

      {/* Archive confirmation dialog */}
      <Dialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Arquivar lead</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja arquivar este lead? O lead não aparecerá mais na lista principal.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowArchiveDialog(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleArchive} disabled={isPending}>
              Arquivar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Message Generator */}
      <AIMessageGenerator
        open={showAIGenerator}
        onOpenChange={setShowAIGenerator}
        leadContext={{
          nome_fantasia: lead.nome_fantasia,
          razao_social: lead.razao_social,
          cnpj: lead.cnpj,
          email: lead.email,
          telefone: lead.telefone,
          porte: lead.porte,
          cnae: lead.cnae,
          situacao_cadastral: lead.situacao_cadastral,
          faturamento_estimado: lead.faturamento_estimado,
          endereco: lead.endereco ? { cidade: lead.endereco.cidade, uf: lead.endereco.uf } : null,
          socios: lead.socios?.map((s) => ({ nome: s.nome, qualificacao: s.qualificacao })) ?? null,
        } satisfies LeadContext}
      />

      {/* Schedule Meeting Modal */}
      <ScheduleMeetingModal
        open={showMeetingModal}
        onOpenChange={setShowMeetingModal}
        leadId={lead.id}
        leadEmail={lead.email}
        leadName={lead.nome_fantasia ?? lead.razao_social}
      />

      {/* Edit dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar lead</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="razao_social">Razão Social</Label>
              <Input
                id="razao_social"
                value={editData.razao_social}
                onChange={(e) => setEditData({ ...editData, razao_social: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="nome_fantasia">Nome Fantasia</Label>
              <Input
                id="nome_fantasia"
                value={editData.nome_fantasia}
                onChange={(e) => setEditData({ ...editData, nome_fantasia: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={editData.email}
                onChange={(e) => setEditData({ ...editData, email: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                value={editData.telefone}
                onChange={(e) => setEditData({ ...editData, telefone: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleEdit} disabled={isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
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
