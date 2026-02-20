'use client';

import { useCallback, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, Download, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';

import { bulkArchiveLeads, bulkEnrichLeads, exportLeadsCsv } from '../actions/bulk-actions';
import type { LeadRow } from '../types';
import { formatCnpj } from '../utils/cnpj';
import { EnrichmentStatusBadge, LeadStatusBadge } from './LeadStatusBadge';

interface LeadTableProps {
  leads: LeadRow[];
}

export function LeadTable({ leads }: LeadTableProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const allSelected = leads.length > 0 && selected.size === leads.length;
  const someSelected = selected.size > 0 && selected.size < leads.length;

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(leads.map((l) => l.id)));
    }
  }, [allSelected, leads]);

  const toggleOne = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleArchive = useCallback(() => {
    const ids = Array.from(selected);
    startTransition(async () => {
      const result = await bulkArchiveLeads(ids);
      if (result.success) {
        toast.success(`${result.data.count} leads arquivados`);
        setSelected(new Set());
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }, [selected, router]);

  const handleEnrich = useCallback(() => {
    const ids = Array.from(selected);
    startTransition(async () => {
      const result = await bulkEnrichLeads(ids);
      if (result.success) {
        toast.success(`${result.data.successCount} enriquecidos, ${result.data.failCount} falharam`);
        setSelected(new Set());
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }, [selected, router]);

  const handleExport = useCallback(() => {
    const ids = Array.from(selected);
    startTransition(async () => {
      const result = await exportLeadsCsv(ids);
      if (result.success) {
        // Trigger download
        const blob = new Blob([result.data.csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.data.filename;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('CSV exportado');
      } else {
        toast.error(result.error);
      }
    });
  }, [selected]);

  const navigateToLead = useCallback(
    (id: string) => {
      router.push(`/leads/${id}`);
    },
    [router],
  );

  return (
    <div className="space-y-3">
      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 rounded-md bg-[var(--muted)] p-2">
          <span className="text-sm font-medium">
            {selected.size} lead{selected.size > 1 ? 's' : ''} selecionado{selected.size > 1 ? 's' : ''}
          </span>
          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleEnrich}
              disabled={isPending}
            >
              <RefreshCw className="mr-1 h-3.5 w-3.5" />
              Enriquecer
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleArchive}
              disabled={isPending}
            >
              <Archive className="mr-1 h-3.5 w-3.5" />
              Arquivar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={isPending}
            >
              <Download className="mr-1 h-3.5 w-3.5" />
              Exportar CSV
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                  onCheckedChange={toggleAll}
                  aria-label="Selecionar todos"
                />
              </TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>CNPJ</TableHead>
              <TableHead>Porte</TableHead>
              <TableHead>CNAE</TableHead>
              <TableHead>Cidade/UF</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Enriquecimento</TableHead>
              <TableHead>Importado em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead) => {
              const isSelected = selected.has(lead.id);
              return (
                <TableRow
                  key={lead.id}
                  data-state={isSelected ? 'selected' : undefined}
                  className="cursor-pointer"
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleOne(lead.id)}
                      aria-label={`Selecionar ${lead.nome_fantasia ?? lead.cnpj}`}
                    />
                  </TableCell>
                  <TableCell
                    className="font-medium"
                    onClick={() => navigateToLead(lead.id)}
                  >
                    <div>
                      <div>{lead.nome_fantasia ?? lead.razao_social ?? '—'}</div>
                      {lead.nome_fantasia && lead.razao_social && (
                        <div className="text-xs text-[var(--muted-foreground)]">
                          {lead.razao_social}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell onClick={() => navigateToLead(lead.id)}>
                    {formatCnpj(lead.cnpj)}
                  </TableCell>
                  <TableCell onClick={() => navigateToLead(lead.id)}>
                    {lead.porte ?? '—'}
                  </TableCell>
                  <TableCell onClick={() => navigateToLead(lead.id)}>
                    {lead.cnae ?? '—'}
                  </TableCell>
                  <TableCell onClick={() => navigateToLead(lead.id)}>
                    {lead.endereco
                      ? [lead.endereco.cidade, lead.endereco.uf].filter(Boolean).join('/') || '—'
                      : '—'}
                  </TableCell>
                  <TableCell onClick={() => navigateToLead(lead.id)}>
                    <LeadStatusBadge status={lead.status} />
                  </TableCell>
                  <TableCell onClick={() => navigateToLead(lead.id)}>
                    <EnrichmentStatusBadge status={lead.enrichment_status} />
                  </TableCell>
                  <TableCell onClick={() => navigateToLead(lead.id)}>
                    {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
