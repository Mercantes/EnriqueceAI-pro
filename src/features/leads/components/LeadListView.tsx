'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { FileUp, Users } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import { EmptyState } from '@/shared/components/EmptyState';

import type { LeadListResult } from '../leads.contract';
import { LeadFilters } from './LeadFilters';
import { LeadPagination } from './LeadPagination';
import { LeadTable } from './LeadTable';

interface LeadListViewProps {
  result: LeadListResult;
  hasFilters: boolean;
}

export function LeadListView({ result, hasFilters }: LeadListViewProps) {
  const { data: leads, total, page, per_page } = result;

  // Empty state: no leads at all
  if (leads.length === 0 && !hasFilters) {
    return (
      <EmptyState
        icon={Users}
        title="Nenhum lead ainda"
        description="Importe seu primeiro arquivo CSV para começar a prospectar."
        action={{ label: 'Importar CSV', href: '/leads/import' }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Leads</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            {total} lead{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
          </p>
        </div>
        <Button asChild>
          <Link href="/leads/import">
            <FileUp className="mr-2 h-4 w-4" />
            Importar CSV
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <Suspense>
        <LeadFilters />
      </Suspense>

      {/* Table or filtered empty */}
      {leads.length === 0 && hasFilters ? (
        <div className="py-12 text-center text-[var(--muted-foreground)]">
          Nenhum lead encontrado com os filtros aplicados.
        </div>
      ) : (
        <LeadTable leads={leads} />
      )}

      {/* Pagination */}
      <Suspense>
        <LeadPagination total={total} page={page} perPage={per_page} />
      </Suspense>
    </div>
  );
}
