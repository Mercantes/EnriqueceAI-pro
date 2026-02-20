'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { MoreHorizontal, Pause, Play, Plus, Trash2, Zap } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { Input } from '@/shared/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';

import type { CadenceRow, CadenceStatus } from '../types';
import { deleteCadence, updateCadence } from '../actions/manage-cadences';

interface CadenceListViewProps {
  cadences: CadenceRow[];
  total: number;
  page: number;
  perPage: number;
}

const ALL_VALUE = '__all__';

const statusConfig: Record<CadenceStatus, { label: string; className: string }> = {
  draft: {
    label: 'Rascunho',
    className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  },
  active: {
    label: 'Ativa',
    className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  },
  paused: {
    label: 'Pausada',
    className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  },
  archived: {
    label: 'Arquivada',
    className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  },
};

export function CadenceListView({ cadences, total, page, perPage }: CadenceListViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function updateParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (!value || value === ALL_VALUE) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    params.set('page', '1');
    router.push(`/cadences?${params.toString()}`);
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteCadence(id);
      if (result.success) {
        toast.success('Cadência deletada');
        router.refresh();
      } else {
        toast.error(result.error);
      }
      setDeleteId(null);
    });
  }

  function handleToggleStatus(cadence: CadenceRow) {
    startTransition(async () => {
      const newStatus = cadence.status === 'active' ? 'paused' : 'active';
      const result = await updateCadence(cadence.id, { status: newStatus });
      if (result.success) {
        toast.success(newStatus === 'active' ? 'Cadência ativada' : 'Cadência pausada');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cadências</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            {total} cadência{total !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => router.push('/cadences/new')}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Cadência
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Input
          placeholder="Buscar por nome..."
          defaultValue={searchParams.get('search') ?? ''}
          className="max-w-xs"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              updateParams({ search: (e.target as HTMLInputElement).value });
            }
          }}
        />
        <Select
          value={searchParams.get('status') ?? ALL_VALUE}
          onValueChange={(v) => updateParams({ status: v })}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Todos</SelectItem>
            <SelectItem value="draft">Rascunho</SelectItem>
            <SelectItem value="active">Ativa</SelectItem>
            <SelectItem value="paused">Pausada</SelectItem>
            <SelectItem value="archived">Arquivada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Cadence list */}
      {cadences.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 rounded-full bg-[var(--muted)] p-4">
            <Zap className="h-10 w-10 text-[var(--muted-foreground)]" />
          </div>
          <h3 className="mb-2 text-lg font-semibold">Nenhuma cadência encontrada</h3>
          <p className="mb-6 max-w-sm text-sm text-[var(--muted-foreground)]">
            Crie sua primeira cadência para automatizar o contato com leads.
          </p>
          <Button onClick={() => router.push('/cadences/new')}>
            <Plus className="mr-2 h-4 w-4" />
            Criar Cadência
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {cadences.map((cadence) => {
            const config = statusConfig[cadence.status];
            return (
              <Card key={cadence.id} className="relative">
                <CardContent className="p-4">
                  <div className="mb-3 flex items-start justify-between">
                    <Badge variant="outline" className={config.className}>
                      {config.label}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label={`Ações para ${cadence.name}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {(cadence.status === 'active' || cadence.status === 'paused') && (
                          <DropdownMenuItem onClick={() => handleToggleStatus(cadence)}>
                            {cadence.status === 'active' ? (
                              <><Pause className="mr-2 h-4 w-4" />Pausar</>
                            ) : (
                              <><Play className="mr-2 h-4 w-4" />Ativar</>
                            )}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => setDeleteId(cadence.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Deletar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => router.push(`/cadences/${cadence.id}`)}
                  >
                    <h3 className="mb-1 font-medium">{cadence.name}</h3>
                    {cadence.description && (
                      <p className="mb-2 line-clamp-2 text-sm text-[var(--muted-foreground)]">
                        {cadence.description}
                      </p>
                    )}
                  </button>

                  <div className="mt-3 flex items-center gap-4 text-xs text-[var(--muted-foreground)]">
                    <div className="flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      {cadence.total_steps} passo{cadence.total_steps !== 1 ? 's' : ''}
                    </div>
                    <span>{new Date(cadence.created_at).toLocaleDateString('pt-BR')}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString());
              params.set('page', String(page - 1));
              router.push(`/cadences?${params.toString()}`);
            }}
          >
            Anterior
          </Button>
          <span className="text-sm text-[var(--muted-foreground)]">
            Página {page} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString());
              params.set('page', String(page + 1));
              router.push(`/cadences?${params.toString()}`);
            }}
          >
            Próxima
          </Button>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deletar cadência</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja deletar esta cadência? Os enrollments ativos serão encerrados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={() => deleteId && handleDelete(deleteId)}
            >
              {isPending ? 'Deletando...' : 'Deletar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
