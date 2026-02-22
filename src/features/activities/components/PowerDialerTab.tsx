'use client';

import { Phone, Pause, Play, SkipForward, Zap } from 'lucide-react';

import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';

type DialerStatus = 'waiting' | 'in_call' | 'completed';

interface MockLead {
  id: string;
  name: string;
  phone: string;
  status: DialerStatus;
}

const MOCK_LEADS: MockLead[] = [
  { id: '1', name: 'Maria Silva', phone: '(11) 99999-1234', status: 'completed' },
  { id: '2', name: 'João Santos', phone: '(21) 98765-4321', status: 'in_call' },
  { id: '3', name: 'Ana Costa', phone: '(31) 97654-3210', status: 'waiting' },
  { id: '4', name: 'Pedro Oliveira', phone: '(41) 96543-2109', status: 'waiting' },
  { id: '5', name: 'Carla Souza', phone: '(51) 95432-1098', status: 'waiting' },
];

const statusConfig: Record<DialerStatus, { label: string; variant: 'secondary' | 'default' | 'outline'; className: string }> = {
  waiting: { label: 'Aguardando', variant: 'secondary', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  in_call: { label: 'Em chamada', variant: 'default', className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  completed: { label: 'Concluído', variant: 'outline', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
};

function LeadAvatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--muted)] text-xs font-medium">
      {initials}
    </div>
  );
}

export function PowerDialerTab() {
  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50">
          <Zap className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <p className="font-medium text-amber-800 dark:text-amber-200">Em breve — Integração com provedor VoIP</p>
          <p className="text-sm text-amber-700 dark:text-amber-300">
            O Power Dialer permitirá discagem automática integrada com Twilio ou Vonage.
            Acompanhe o progresso desta feature.
          </p>
        </div>
      </div>

      {/* Controls (disabled) */}
      <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <div className="flex items-center gap-2">
          <Phone className="h-5 w-5 text-[var(--muted-foreground)]" />
          <span className="text-sm font-medium">Fila de Discagem</span>
          <Badge variant="secondary" className="text-xs">{MOCK_LEADS.length} leads</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" disabled aria-label="Play">
                <Play className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Em breve</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" disabled aria-label="Pause">
                <Pause className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Em breve</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" disabled aria-label="Skip">
                <SkipForward className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Em breve</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Lead queue */}
      <div className="space-y-2">
        {MOCK_LEADS.map((lead) => {
          const status = statusConfig[lead.status];
          return (
            <div
              key={lead.id}
              className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <LeadAvatar name={lead.name} />
                <div>
                  <p className="text-sm font-medium">{lead.name}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">{lead.phone}</p>
                </div>
              </div>
              <Badge variant={status.variant} className={status.className}>
                {status.label}
              </Badge>
            </div>
          );
        })}
      </div>
    </div>
  );
}
