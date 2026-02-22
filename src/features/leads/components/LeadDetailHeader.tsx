'use client';

import { useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Archive,
  Calendar,
  ChevronLeft,
  Edit2,
  Mail,
  MoreHorizontal,
  Phone,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';

import { updateLead } from '../actions/update-lead';
import type { LeadRow } from '../types';

interface LeadDetailHeaderProps {
  lead: LeadRow;
  onShowEmail: () => void;
  onShowCadence: () => void;
  onShowAI: () => void;
  onShowMeeting: () => void;
  onShowEdit: () => void;
  onShowArchive: () => void;
  onEnrich: () => void;
}

export function LeadDetailHeader({
  lead,
  onShowEmail,
  onShowCadence,
  onShowAI,
  onShowMeeting,
  onShowEdit,
  onShowArchive,
  onEnrich,
}: LeadDetailHeaderProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const personName = lead.socios?.[0]?.nome ?? null;
  const companyName = lead.nome_fantasia ?? lead.razao_social ?? null;
  const primaryName = personName ?? companyName ?? '—';
  const secondaryName = personName ? companyName : null;

  const handleStatusChange = useCallback((status: 'qualified' | 'unqualified') => {
    startTransition(async () => {
      const result = await updateLead(lead.id, { status });
      if (result.success) {
        toast.success(status === 'qualified' ? 'Lead marcado como ganho' : 'Lead marcado como perdido');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }, [lead.id, router]);

  return (
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => router.push('/leads')}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">{primaryName}</h1>
          {secondaryName && (
            <p className="text-sm text-[var(--muted-foreground)]">{secondaryName}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {lead.telefone && (
          <Button variant="outline" size="sm" asChild>
            <a href={`tel:${lead.telefone}`}>
              <Phone className="mr-1 h-4 w-4" />
              Ligar
            </a>
          </Button>
        )}
        <Button
          size="sm"
          className="bg-green-600 hover:bg-green-700"
          onClick={() => handleStatusChange('qualified')}
          disabled={isPending || lead.status === 'qualified'}
        >
          <ThumbsUp className="mr-1 h-4 w-4" />
          Ganho
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => handleStatusChange('unqualified')}
          disabled={isPending || lead.status === 'unqualified'}
        >
          <ThumbsDown className="mr-1 h-4 w-4" />
          Perdido
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onShowEmail}>
              <Mail className="mr-2 h-3.5 w-3.5" />
              Enviar Email
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onShowCadence}>
              <Zap className="mr-2 h-3.5 w-3.5" />
              Inscrever em Cadência
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onShowAI}>
              <Sparkles className="mr-2 h-3.5 w-3.5" />
              Gerar com IA
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onShowMeeting}>
              <Calendar className="mr-2 h-3.5 w-3.5" />
              Agendar Reunião
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onEnrich}>
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
              Enriquecer
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onShowEdit}>
              <Edit2 className="mr-2 h-3.5 w-3.5" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onShowArchive} className="text-red-600">
              <Archive className="mr-2 h-3.5 w-3.5" />
              Arquivar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
