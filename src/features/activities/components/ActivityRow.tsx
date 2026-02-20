'use client';

import {
  ChevronDown,
  Clock,
  Mail,
  MessageSquare,
  Play,
} from 'lucide-react';

import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';

import type { PendingActivity } from '../types';

interface ActivityRowProps {
  activity: PendingActivity;
  onExecute: () => void;
  onSkip: () => void;
}

function formatRelativeTime(dateStr: string): { text: string; isUrgent: boolean } {
  const now = Date.now();
  const due = new Date(dateStr).getTime();
  const diffMs = now - due;
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  const isUrgent = diffHours >= 24;

  if (diffMinutes < 1) return { text: 'Agora', isUrgent };
  if (diffMinutes < 60) return { text: `Há ${diffMinutes}min`, isUrgent };
  if (diffHours < 24) return { text: `Há ${diffHours}h`, isUrgent };
  return { text: `Há ${diffDays}d`, isUrgent };
}

export function ActivityRow({ activity, onExecute, onSkip }: ActivityRowProps) {
  const { text: timeText, isUrgent } = formatRelativeTime(activity.nextStepDue);

  return (
    <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3 transition-colors hover:bg-[var(--accent)]/50">
      {/* Time badge */}
      <span
        className={`shrink-0 text-xs font-semibold tabular-nums ${
          isUrgent ? 'text-red-500' : 'text-[var(--muted-foreground)]'
        }`}
      >
        {timeText}
      </span>

      {/* Channel badge */}
      <Badge variant="outline" className="shrink-0 gap-1">
        {activity.channel === 'whatsapp' ? (
          <><MessageSquare className="h-3 w-3" />WhatsApp</>
        ) : (
          <><Mail className="h-3 w-3" />Email</>
        )}
      </Badge>

      {/* Cadence + step info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">
            {activity.cadenceName}
          </span>
          <span className="shrink-0 text-xs text-[var(--muted-foreground)]">
            Passo {activity.stepOrder} de {activity.totalSteps}
          </span>
        </div>
      </div>

      {/* Lead info */}
      <div className="hidden min-w-0 max-w-[200px] shrink-0 text-right sm:block">
        <p className="truncate text-sm font-medium">
          {activity.lead.nome_fantasia ?? activity.lead.razao_social ?? activity.lead.cnpj}
        </p>
        <p className="truncate text-xs text-[var(--muted-foreground)]">
          {activity.lead.email ?? 'Sem email'}
        </p>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1">
        <Button size="sm" onClick={onExecute} className="gap-1.5">
          <Play className="h-3.5 w-3.5" />
          Executar
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 w-8 p-0">
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onSkip}>
              <Clock className="mr-2 h-3.5 w-3.5" />
              Pular (+2h)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
