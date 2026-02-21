'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  Check,
  Database,
  Loader2,
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

import type { Api4ComConnectionSafe, CalendarConnectionSafe, CrmConnectionSafe, GmailConnectionSafe, WhatsAppConnectionSafe } from '../types';
import { disconnectGmail, getGmailAuthUrl } from '../actions/manage-gmail';
import { disconnectCrm, getCrmAuthUrl, triggerCrmSync } from '../actions/manage-crm';
import { disconnectCalendar } from '../actions/manage-calendar';

interface IntegrationsViewProps {
  gmail: GmailConnectionSafe | null;
  whatsapp: WhatsAppConnectionSafe | null;
  crm: CrmConnectionSafe | null;
  calendar: CalendarConnectionSafe | null;
  api4com: Api4ComConnectionSafe | null;
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

export function IntegrationsView({ gmail, whatsapp, crm, calendar, api4com }: IntegrationsViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showDisconnect, setShowDisconnect] = useState<'google' | 'crm' | null>(null);

  function handleConnectGoogle() {
    startTransition(async () => {
      const result = await getGmailAuthUrl();
      if (result.success) {
        window.location.href = result.data.url;
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleDisconnectGoogle() {
    startTransition(async () => {
      const results = await Promise.allSettled([
        gmail ? disconnectGmail() : Promise.resolve(null),
        calendar ? disconnectCalendar() : Promise.resolve(null),
      ]);

      const hasError = results.some(
        (r) => r.status === 'fulfilled' && r.value && 'success' in r.value && !r.value.success,
      );

      if (hasError) {
        toast.error('Erro ao desconectar conta Google');
      } else {
        toast.success('Google desconectado');
      }
      setShowDisconnect(null);
      router.refresh();
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
        {/* Google Card (Gmail + Calendar) */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Image src="/logos/google-logo.png" alt="Google" width={40} height={40} className="rounded-lg" />
                <div>
                  <CardTitle className="text-base">Google</CardTitle>
                  <p className="text-xs text-[var(--muted-foreground)]">Email e Agenda</p>
                </div>
              </div>
              {(gmail || calendar) && (
                <Badge variant="outline" className={statusConfig[(gmail?.status === 'error' || calendar?.status === 'error') ? 'error' : 'connected'].className}>
                  {(gmail?.status === 'error' || calendar?.status === 'error')
                    ? <><X className="mr-1 h-3 w-3" />Erro</>
                    : <><Check className="mr-1 h-3 w-3" />Conectado</>}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {gmail || calendar ? (
              <div className="space-y-4">
                {/* Gmail details */}
                {gmail && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-[var(--muted-foreground)]">Gmail</p>
                    <div className="rounded-md bg-[var(--muted)] p-3">
                      <p className="text-sm font-medium">{gmail.email_address}</p>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        Conectado em {new Date(gmail.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                )}

                {/* Calendar details */}
                {calendar && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-[var(--muted-foreground)]">Google Calendar</p>
                    <div className="rounded-md bg-[var(--muted)] p-3">
                      <p className="text-sm font-medium">{calendar.calendar_email}</p>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        Conectado em {new Date(calendar.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600"
                  onClick={() => setShowDisconnect('google')}
                >
                  <Unplug className="mr-2 h-4 w-4" />
                  Desconectar
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-[var(--muted-foreground)]">
                  Conecte sua conta Google para enviar e ler emails de cadência, e agendar reuniões com leads via Google Calendar.
                </p>
                <Button onClick={handleConnectGoogle} disabled={isPending}>
                  {isPending ? 'Conectando...' : 'Conectar Google'}
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
                <Image src="/logos/whatsapp-logo.png" alt="WhatsApp" width={40} height={40} className="rounded-lg" />
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

        {/* API4Com VoIP Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Image src="/logos/api4com-logo.png" alt="API4Com" width={40} height={40} className="rounded-lg" />
                <div>
                  <CardTitle className="text-base">API4Com</CardTitle>
                  <p className="text-xs text-[var(--muted-foreground)]">Discador VoIP</p>
                </div>
              </div>
              {api4com && (
                <Badge variant="outline" className={statusConfig[api4com.status].className}>
                  {api4com.status === 'connected' && <Check className="mr-1 h-3 w-3" />}
                  {api4com.status === 'error' && <X className="mr-1 h-3 w-3" />}
                  {statusConfig[api4com.status].label}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {api4com ? (
              <div className="space-y-4">
                <p className="text-sm text-[var(--muted-foreground)]">
                  Discador VoIP integrado. Sincronize ligações e grave chamadas automaticamente.
                </p>
                <div className="border-t border-[var(--border)] pt-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm">Ramal {api4com.ramal}</p>
                    <Button variant="outline" size="sm">
                      Gerenciar
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-[var(--muted-foreground)]">
                  Discador VoIP integrado. Sincronize ligações e grave chamadas automaticamente.
                </p>
                <Badge variant="secondary">Em breve</Badge>
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

      {/* Disconnect Google dialog */}
      <Dialog open={showDisconnect === 'google'} onOpenChange={() => setShowDisconnect(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desconectar Google</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja desconectar sua conta Google? Cadências com passos de email não poderão ser executadas e não será possível agendar reuniões pela plataforma.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDisconnect(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={isPending} onClick={handleDisconnectGoogle}>
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
