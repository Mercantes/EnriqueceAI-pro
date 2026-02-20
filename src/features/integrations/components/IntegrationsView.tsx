'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  Calendar,
  Check,
  Database,
  Loader2,
  Mail,
  MessageSquare,
  RefreshCw,
  Unplug,
  X,
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

import type { CalendarConnectionSafe, CrmConnectionSafe, GmailConnectionSafe, WhatsAppConnectionSafe } from '../types';
import { disconnectGmail, getGmailAuthUrl } from '../actions/manage-gmail';
import { disconnectCrm, getCrmAuthUrl, triggerCrmSync } from '../actions/manage-crm';
import { disconnectCalendar, getCalendarAuthUrl } from '../actions/manage-calendar';

interface IntegrationsViewProps {
  gmail: GmailConnectionSafe | null;
  whatsapp: WhatsAppConnectionSafe | null;
  crm: CrmConnectionSafe | null;
  calendar: CalendarConnectionSafe | null;
}

const statusConfig = {
  connected: { label: 'Conectado', className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  disconnected: { label: 'Desconectado', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  error: { label: 'Erro', className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
  syncing: { label: 'Sincronizando', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
} as const;

const CRM_LABELS: Record<string, string> = {
  hubspot: 'HubSpot',
  pipedrive: 'Pipedrive',
  rdstation: 'RD Station',
};

export function IntegrationsView({ gmail, whatsapp, crm, calendar }: IntegrationsViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showDisconnect, setShowDisconnect] = useState<'gmail' | 'crm' | 'calendar' | null>(null);

  function handleConnectGmail() {
    startTransition(async () => {
      const result = await getGmailAuthUrl();
      if (result.success) {
        window.location.href = result.data.url;
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleDisconnectGmail() {
    startTransition(async () => {
      const result = await disconnectGmail();
      if (result.success) {
        toast.success('Gmail desconectado');
        setShowDisconnect(null);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleConnectCalendar() {
    startTransition(async () => {
      const result = await getCalendarAuthUrl();
      if (result.success) {
        window.location.href = result.data.url;
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleDisconnectCalendar() {
    startTransition(async () => {
      const result = await disconnectCalendar();
      if (result.success) {
        toast.success('Google Calendar desconectado');
        setShowDisconnect(null);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleConnectCrm(provider: 'hubspot' | 'pipedrive' | 'rdstation') {
    startTransition(async () => {
      const result = await getCrmAuthUrl(provider);
      if (result.success) {
        window.location.href = result.data.url;
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleDisconnectCrm() {
    if (!crm) return;
    startTransition(async () => {
      const result = await disconnectCrm(crm.crm_provider);
      if (result.success) {
        toast.success('CRM desconectado');
        setShowDisconnect(null);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleSyncCrm() {
    if (!crm) return;
    startTransition(async () => {
      const result = await triggerCrmSync(crm.crm_provider);
      if (result.success) {
        toast.success(result.data.message);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Integrações</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Conecte suas contas para enviar mensagens e sincronizar dados automaticamente.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Gmail Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900">
                  <Mail className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <CardTitle className="text-base">Gmail</CardTitle>
                  <p className="text-xs text-[var(--muted-foreground)]">Envio de emails via Gmail</p>
                </div>
              </div>
              {gmail && (
                <Badge variant="outline" className={statusConfig[gmail.status].className}>
                  {gmail.status === 'connected' && <Check className="mr-1 h-3 w-3" />}
                  {gmail.status === 'error' && <X className="mr-1 h-3 w-3" />}
                  {gmail.status === 'syncing' && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                  {statusConfig[gmail.status].label}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {gmail ? (
              <div className="space-y-3">
                <div className="rounded-md bg-[var(--muted)] p-3">
                  <p className="text-sm font-medium">{gmail.email_address}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Conectado em {new Date(gmail.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600"
                  onClick={() => setShowDisconnect('gmail')}
                >
                  <Unplug className="mr-2 h-4 w-4" />
                  Desconectar
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-[var(--muted-foreground)]">
                  Conecte sua conta Gmail para enviar emails de cadência do seu próprio endereço.
                </p>
                <Button onClick={handleConnectGmail} disabled={isPending}>
                  <Mail className="mr-2 h-4 w-4" />
                  {isPending ? 'Conectando...' : 'Conectar Gmail'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* WhatsApp Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900">
                  <MessageSquare className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <CardTitle className="text-base">WhatsApp Business</CardTitle>
                  <p className="text-xs text-[var(--muted-foreground)]">Envio via Meta Cloud API</p>
                </div>
              </div>
              {whatsapp && (
                <Badge variant="outline" className={statusConfig[whatsapp.status].className}>
                  {whatsapp.status === 'connected' && <Check className="mr-1 h-3 w-3" />}
                  {statusConfig[whatsapp.status].label}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {whatsapp ? (
              <div className="space-y-3">
                <div className="rounded-md bg-[var(--muted)] p-3">
                  <p className="text-sm font-medium">Phone ID: {whatsapp.phone_number_id}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Business: {whatsapp.business_account_id}
                  </p>
                </div>
                <Badge variant="outline">Gerenciado pelo administrador</Badge>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-[var(--muted-foreground)]">
                  Integração WhatsApp Business estará disponível em breve. Requer verificação Meta Business.
                </p>
                <Badge variant="secondary">Em breve</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Google Calendar Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900">
                  <Calendar className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <CardTitle className="text-base">Google Calendar</CardTitle>
                  <p className="text-xs text-[var(--muted-foreground)]">Agendar reuniões com leads</p>
                </div>
              </div>
              {calendar && (
                <Badge variant="outline" className={statusConfig[calendar.status].className}>
                  {calendar.status === 'connected' && <Check className="mr-1 h-3 w-3" />}
                  {calendar.status === 'error' && <X className="mr-1 h-3 w-3" />}
                  {statusConfig[calendar.status].label}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {calendar ? (
              <div className="space-y-3">
                <div className="rounded-md bg-[var(--muted)] p-3">
                  <p className="text-sm font-medium">{calendar.calendar_email}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Conectado em {new Date(calendar.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600"
                  onClick={() => setShowDisconnect('calendar')}
                >
                  <Unplug className="mr-2 h-4 w-4" />
                  Desconectar
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-[var(--muted-foreground)]">
                  Conecte seu Google Calendar para agendar reuniões com leads e gerar links do Google Meet.
                </p>
                <Button onClick={handleConnectCalendar} disabled={isPending}>
                  <Calendar className="mr-2 h-4 w-4" />
                  {isPending ? 'Conectando...' : 'Conectar Google Calendar'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* HubSpot CRM Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900">
                  <Database className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <CardTitle className="text-base">
                    {crm ? CRM_LABELS[crm.crm_provider] ?? crm.crm_provider : 'HubSpot'}
                  </CardTitle>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Sincronização bidirecional de CRM
                  </p>
                </div>
              </div>
              {crm && (
                <Badge variant="outline" className={statusConfig[crm.status].className}>
                  {crm.status === 'connected' && <Check className="mr-1 h-3 w-3" />}
                  {crm.status === 'error' && <X className="mr-1 h-3 w-3" />}
                  {crm.status === 'syncing' && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                  {statusConfig[crm.status].label}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {crm ? (
              <div className="space-y-3">
                <div className="rounded-md bg-[var(--muted)] p-3">
                  <p className="text-sm font-medium">
                    {CRM_LABELS[crm.crm_provider] ?? crm.crm_provider}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {crm.last_sync_at
                      ? `Último sync: ${new Date(crm.last_sync_at).toLocaleString('pt-BR')}`
                      : 'Nunca sincronizado'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSyncCrm}
                    disabled={isPending || crm.status === 'syncing'}
                  >
                    <RefreshCw className={`mr-2 h-4 w-4 ${crm.status === 'syncing' ? 'animate-spin' : ''}`} />
                    {crm.status === 'syncing' ? 'Sincronizando...' : 'Sincronizar'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600"
                    onClick={() => setShowDisconnect('crm')}
                  >
                    <Unplug className="mr-2 h-4 w-4" />
                    Desconectar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-[var(--muted-foreground)]">
                  Conecte seu CRM para sincronizar leads e atividades automaticamente. Apenas um CRM por organização.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => handleConnectCrm('hubspot')} disabled={isPending}>
                    {isPending ? 'Conectando...' : 'HubSpot'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleConnectCrm('pipedrive')} disabled={isPending}>
                    Pipedrive
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleConnectCrm('rdstation')} disabled={isPending}>
                    RD Station
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Disconnect Gmail dialog */}
      <Dialog open={showDisconnect === 'gmail'} onOpenChange={() => setShowDisconnect(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desconectar Gmail</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja desconectar sua conta Gmail? Cadências com passos de email não poderão ser executadas.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDisconnect(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={isPending} onClick={handleDisconnectGmail}>
              {isPending ? 'Desconectando...' : 'Desconectar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disconnect Calendar dialog */}
      <Dialog open={showDisconnect === 'calendar'} onOpenChange={() => setShowDisconnect(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desconectar Google Calendar</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja desconectar seu Google Calendar? Não será possível agendar reuniões pela plataforma.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDisconnect(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={isPending} onClick={handleDisconnectCalendar}>
              {isPending ? 'Desconectando...' : 'Desconectar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disconnect CRM dialog */}
      <Dialog open={showDisconnect === 'crm'} onOpenChange={() => setShowDisconnect(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desconectar CRM</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja desconectar seu CRM? A sincronização automática será interrompida.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDisconnect(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={isPending} onClick={handleDisconnectCrm}>
              {isPending ? 'Desconectando...' : 'Desconectar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
