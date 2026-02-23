'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  Check,
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

import type { Api4ComConnectionSafe, CalendarConnectionSafe, CrmConnectionSafe, GmailConnectionSafe, WhatsAppConnectionSafe, WhatsAppEvolutionInstanceSafe } from '../types';
import { disconnectGmail, getGmailAuthUrl } from '../actions/manage-gmail';
import { disconnectApi4Com } from '../actions/manage-api4com';
import { useEvolutionWhatsApp } from '../hooks/useEvolutionWhatsApp';
import { Api4ComConfigModal } from './Api4ComConfigModal';
import { WhatsAppEvolutionModal } from './WhatsAppEvolutionModal';

interface IntegrationsViewProps {
  gmail: GmailConnectionSafe | null;
  whatsapp: WhatsAppConnectionSafe | null;
  crm: CrmConnectionSafe | null;
  calendar: CalendarConnectionSafe | null;
  api4com: Api4ComConnectionSafe | null;
  evolutionInstance: WhatsAppEvolutionInstanceSafe | null;
}

const statusConfig = {
  connected: { label: 'Conectado', className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  disconnected: { label: 'Desconectado', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  error: { label: 'Erro', className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
  syncing: { label: 'Sincronizando', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
} as const;

export function IntegrationsView({ gmail, whatsapp, crm: _crm, calendar, api4com, evolutionInstance }: IntegrationsViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showDisconnect, setShowDisconnect] = useState<'google' | null>(null);
  const [showEvolutionModal, setShowEvolutionModal] = useState(false);
  const [showApi4ComConfig, setShowApi4ComConfig] = useState(false);
  const [showDisconnectApi4Com, setShowDisconnectApi4Com] = useState(false);
  const evolution = useEvolutionWhatsApp();

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
      const result = await disconnectGmail();
      if (result.success) {
        toast.success('Google desconectado');
      } else {
        toast.error('Erro ao desconectar conta Google');
      }
      setShowDisconnect(null);
      router.refresh();
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
                <div className="rounded-md bg-[var(--muted)] p-3">
                  <p className="text-sm font-medium">{gmail?.email_address ?? calendar?.calendar_email}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Conectado em {new Date((gmail?.created_at ?? calendar?.created_at)!).toLocaleDateString('pt-BR')}
                  </p>
                </div>

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
                  <CardTitle className="text-base">WhatsApp</CardTitle>
                  <p className="text-xs text-[var(--muted-foreground)]">Envio via WhatsApp API</p>
                </div>
              </div>
              {(evolution.step === 'connected' || evolutionInstance?.status === 'connected') ? (
                <Badge variant="outline" className={statusConfig.connected.className}>
                  <Check className="mr-1 h-3 w-3" />Conectado
                </Badge>
              ) : whatsapp?.status === 'connected' ? (
                <Badge variant="outline" className={statusConfig.connected.className}>
                  <Check className="mr-1 h-3 w-3" />Conectado
                </Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            {(evolution.step === 'connected' || evolutionInstance?.status === 'connected') ? (
              <div className="space-y-3">
                <div className="rounded-md bg-[var(--muted)] p-3">
                  <p className="text-sm font-medium">
                    {(evolution.phone || evolutionInstance?.phone)
                      ? `Número: ${evolution.phone || evolutionInstance?.phone}`
                      : 'WhatsApp conectado'}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Conectado{evolutionInstance?.created_at
                      ? ` em ${new Date(evolutionInstance.created_at).toLocaleDateString('pt-BR')}`
                      : ''}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-[var(--muted-foreground)]">
                  Conecte seu WhatsApp para enviar mensagens em cadências e se comunicar com leads.
                </p>
                <Button
                  onClick={() => {
                    setShowEvolutionModal(true);
                    evolution.connect();
                  }}
                  disabled={evolution.step === 'creating' || evolution.step === 'waiting_scan'}
                >
                  Conectar
                </Button>
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
                <div className="rounded-md bg-[var(--muted)] p-3">
                  <p className="text-sm font-medium">Ramal {api4com.ramal}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Conectado em {new Date(api4com.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowApi4ComConfig(true)}
                  >
                    Gerenciar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600"
                    onClick={() => setShowDisconnectApi4Com(true)}
                  >
                    <Unplug className="mr-2 h-4 w-4" />
                    Desconectar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-[var(--muted-foreground)]">
                  Discador VoIP integrado. Sincronize ligações e grave chamadas automaticamente.
                </p>
                <Button onClick={() => setShowApi4ComConfig(true)}>
                  Conectar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* CRM Card — hidden until CRM integrations are configured */}
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

      {/* API4Com config modal */}
      <Api4ComConfigModal
        open={showApi4ComConfig}
        onOpenChange={setShowApi4ComConfig}
        onSuccess={() => router.refresh()}
        defaultRamal={api4com?.ramal ?? ''}
        defaultBaseUrl={api4com?.base_url ?? ''}
        hasExistingApiKey={api4com?.has_api_key ?? false}
      />

      {/* Disconnect API4Com dialog */}
      <Dialog open={showDisconnectApi4Com} onOpenChange={setShowDisconnectApi4Com}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desconectar API4Com</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja desconectar a API4Com? As configurações de ramal e token serão removidas.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDisconnectApi4Com(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={() => {
                startTransition(async () => {
                  const result = await disconnectApi4Com();
                  if (result.success) {
                    toast.success('API4Com desconectado');
                  } else {
                    toast.error(result.error);
                  }
                  setShowDisconnectApi4Com(false);
                  router.refresh();
                });
              }}
            >
              {isPending ? 'Desconectando...' : 'Desconectar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* WhatsApp Evolution QR Code modal */}
      {showEvolutionModal && evolution.step !== 'idle' && (
        <WhatsAppEvolutionModal
          qrBase64={evolution.qrBase64}
          step={evolution.step}
          phone={evolution.phone}
          error={evolution.error}
          onRefreshQr={evolution.refreshQr}
          onClose={() => {
            setShowEvolutionModal(false);
            if (evolution.step === 'connected') {
              router.refresh();
            }
          }}
        />
      )}

    </div>
  );
}
