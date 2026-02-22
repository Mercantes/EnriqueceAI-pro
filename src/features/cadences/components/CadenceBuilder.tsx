'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ArrowLeft, LayoutList, Plus, Save, Sparkles, Trash2, UserPlus, Zap } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Textarea } from '@/shared/components/ui/textarea';

import type { CadenceDetail, CadenceMetrics, EnrollmentWithLead } from '../cadences.contract';
import type { ChannelType, MessageTemplateRow } from '../types';
import { activateCadence, addCadenceStep, removeCadenceStep, updateCadence } from '../actions/manage-cadences';
import { createCadence } from '../actions/manage-cadences';
import { channelConfig } from './ActivityTypeSidebar';
import { EnrollLeadsDialog } from './EnrollLeadsDialog';
import { EnrollmentsList } from './EnrollmentsList';

interface CadenceBuilderProps {
  cadence?: CadenceDetail;
  templates: MessageTemplateRow[];
  metrics?: CadenceMetrics;
  enrollments?: EnrollmentWithLead[];
}

export function CadenceBuilder({ cadence, templates, metrics, enrollments = [] }: CadenceBuilderProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(cadence?.name ?? '');
  const [description, setDescription] = useState(cadence?.description ?? '');
  const [showAddStep, setShowAddStep] = useState(false);
  const [removeStepId, setRemoveStepId] = useState<string | null>(null);
  const [showEnrollDialog, setShowEnrollDialog] = useState(false);

  // New step form
  const [newChannel, setNewChannel] = useState<ChannelType>('email');
  const [newTemplateId, setNewTemplateId] = useState('');
  const [newDelayDays, setNewDelayDays] = useState(0);
  const [newDelayHours, setNewDelayHours] = useState(0);
  const [newAIPersonalization, setNewAIPersonalization] = useState(false);

  const isEditing = !!cadence;
  const isEditable = !cadence || cadence.status === 'draft' || cadence.status === 'paused';
  const steps = cadence?.steps ?? [];

  const filteredTemplates = templates.filter((t) => t.channel === newChannel);

  function handleSave() {
    startTransition(async () => {
      if (isEditing) {
        const result = await updateCadence(cadence.id, { name, description: description || null });
        if (result.success) {
          toast.success('Cadência atualizada');
          router.refresh();
        } else {
          toast.error(result.error);
        }
      } else {
        const result = await createCadence({ name, description: description || null });
        if (result.success) {
          toast.success('Cadência criada');
          router.push(`/cadences/${result.data.id}`);
        } else {
          toast.error(result.error);
        }
      }
    });
  }

  function handleAddStep() {
    if (!cadence) return;
    startTransition(async () => {
      const result = await addCadenceStep(cadence.id, {
        step_order: steps.length + 1,
        channel: newChannel,
        template_id: newTemplateId || null,
        delay_days: newDelayDays,
        delay_hours: newDelayHours,
        ai_personalization: newAIPersonalization,
      });
      if (result.success) {
        toast.success('Passo adicionado');
        setShowAddStep(false);
        setNewTemplateId('');
        setNewDelayDays(0);
        setNewDelayHours(0);
        setNewAIPersonalization(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleRemoveStep(stepId: string) {
    if (!cadence) return;
    startTransition(async () => {
      const result = await removeCadenceStep(cadence.id, stepId);
      if (result.success) {
        toast.success('Passo removido');
        setRemoveStepId(null);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleActivate() {
    if (!cadence) return;
    startTransition(async () => {
      const result = await activateCadence(cadence.id);
      if (result.success) {
        toast.success('Cadência ativada');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/cadences')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <h1 className="text-2xl font-bold">
          {isEditing ? cadence.name : 'Nova Cadência'}
        </h1>
        {cadence && (
          <Badge variant="outline">
            {cadence.status === 'draft' ? 'Rascunho' : cadence.status === 'active' ? 'Ativa' : cadence.status === 'paused' ? 'Pausada' : 'Arquivada'}
          </Badge>
        )}
        {cadence && isEditable && (
          <Button size="sm" variant="outline" onClick={() => router.push(`/cadences/${cadence.id}?view=timeline`)}>
            <LayoutList className="mr-2 h-4 w-4" />
            Timeline Builder
          </Button>
        )}
        {cadence && cadence.status === 'active' && (
          <Button size="sm" onClick={() => setShowEnrollDialog(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Inscrever Leads
          </Button>
        )}
      </div>

      {/* Cadence info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cadence-name">Nome</Label>
            <Input
              id="cadence-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Follow Up Inicial"
              disabled={!isEditable}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cadence-desc">Descrição</Label>
            <Textarea
              id="cadence-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o objetivo desta cadência..."
              rows={3}
              disabled={!isEditable}
            />
          </div>
          <div className="flex gap-2">
            {isEditable && (
              <Button onClick={handleSave} disabled={isPending || !name}>
                <Save className="mr-2 h-4 w-4" />
                {isPending ? 'Salvando...' : isEditing ? 'Salvar' : 'Criar Cadência'}
              </Button>
            )}
            {cadence && cadence.status === 'draft' && steps.length >= 2 && (
              <Button variant="outline" onClick={handleActivate} disabled={isPending}>
                <Zap className="mr-2 h-4 w-4" />
                Ativar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Steps & Enrollments */}
      {isEditing && cadence.status === 'active' ? (
        <Tabs defaultValue="steps">
          <TabsList>
            <TabsTrigger value="steps">Passos ({steps.length})</TabsTrigger>
            <TabsTrigger value="enrollments">Inscritos ({enrollments.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="steps">
            <StepsCard
              steps={steps}
              isEditable={isEditable}
              onAddStep={() => setShowAddStep(true)}
              onRemoveStep={setRemoveStepId}
            />
          </TabsContent>
          <TabsContent value="enrollments">
            <Card>
              <CardContent className="pt-6">
                <EnrollmentsList enrollments={enrollments} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : isEditing ? (
        <StepsCard
          steps={steps}
          isEditable={isEditable}
          onAddStep={() => setShowAddStep(true)}
          onRemoveStep={setRemoveStepId}
        />
      ) : null}

      {/* Metrics */}
      {metrics && metrics.total_enrolled > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Métricas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              <div className="text-center">
                <p className="text-2xl font-bold">{metrics.total_enrolled}</p>
                <p className="text-xs text-[var(--muted-foreground)]">Inscritos</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{metrics.in_progress}</p>
                <p className="text-xs text-[var(--muted-foreground)]">Em progresso</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{metrics.completed}</p>
                <p className="text-xs text-[var(--muted-foreground)]">Completados</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{metrics.replied}</p>
                <p className="text-xs text-[var(--muted-foreground)]">Responderam</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{metrics.bounced}</p>
                <p className="text-xs text-[var(--muted-foreground)]">Bounce</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add step dialog */}
      <Dialog open={showAddStep} onOpenChange={setShowAddStep}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Passo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Canal</Label>
              <Select value={newChannel} onValueChange={(v) => { setNewChannel(v as ChannelType); setNewTemplateId(''); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Template</Label>
              <Select value={newTemplateId} onValueChange={setNewTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um template" />
                </SelectTrigger>
                <SelectContent>
                  {filteredTemplates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} {t.is_system ? '(sistema)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Delay (dias)</Label>
                <Input
                  type="number"
                  min={0}
                  value={newDelayDays}
                  onChange={(e) => setNewDelayDays(parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label>Delay (horas)</Label>
                <Input
                  type="number"
                  min={0}
                  value={newDelayHours}
                  onChange={(e) => setNewDelayHours(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-md border p-3">
              <button
                type="button"
                role="switch"
                aria-checked={newAIPersonalization}
                onClick={() => setNewAIPersonalization(!newAIPersonalization)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${newAIPersonalization ? 'bg-[var(--primary)]' : 'bg-[var(--muted)]'}`}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${newAIPersonalization ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
              <div>
                <Label className="cursor-pointer" onClick={() => setNewAIPersonalization(!newAIPersonalization)}>
                  <Sparkles className="mr-1 inline h-3.5 w-3.5 text-[var(--primary)]" />
                  Personalizar com IA
                </Label>
                <p className="text-xs text-[var(--muted-foreground)]">
                  A IA personaliza a mensagem para cada lead automaticamente
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddStep(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddStep} disabled={isPending}>
              {isPending ? 'Adicionando...' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enroll leads dialog */}
      {cadence && (
        <EnrollLeadsDialog
          open={showEnrollDialog}
          onOpenChange={setShowEnrollDialog}
          cadenceId={cadence.id}
        />
      )}

      {/* Remove step confirmation */}
      <Dialog open={!!removeStepId} onOpenChange={() => setRemoveStepId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover passo</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja remover este passo da cadência?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveStepId(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={() => removeStepId && handleRemoveStep(removeStepId)}
            >
              {isPending ? 'Removendo...' : 'Remover'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface StepsCardProps {
  steps: CadenceDetail['steps'];
  isEditable: boolean;
  onAddStep: () => void;
  onRemoveStep: (stepId: string) => void;
}

function StepsCard({ steps, isEditable, onAddStep, onRemoveStep }: StepsCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            Passos ({steps.length})
          </CardTitle>
          {isEditable && (
            <Button size="sm" variant="outline" onClick={onAddStep}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Passo
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {steps.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">
            Nenhum passo adicionado. Adicione pelo menos 2 passos para ativar a cadência.
          </p>
        ) : (
          <div className="space-y-2">
            {steps.map((step, index) => {
              const config = channelConfig[step.channel];
              if (!config) return null;
              const Icon = config.icon;
              return (
                <div
                  key={step.id}
                  className="flex items-center gap-3 rounded-lg border bg-[var(--card)] px-3 py-2.5"
                >
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${config.bgColor}`}>
                    <span className="text-xs font-bold">{index + 1}</span>
                  </div>
                  <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded ${config.bgColor}`}>
                    <Icon className={`h-3.5 w-3.5 ${config.color}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {config.label}
                      </span>
                      {step.template && (
                        <span className="truncate text-sm text-[var(--muted-foreground)]">
                          — {step.template.name}
                        </span>
                      )}
                      {step.ai_personalization && (
                        <Badge variant="secondary" className="inline-flex items-center gap-0.5 px-1.5 py-0 text-[10px]">
                          <Sparkles className="h-2.5 w-2.5" />
                          IA
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {step.delay_days > 0 || step.delay_hours > 0
                        ? `Esperar ${step.delay_days > 0 ? `${step.delay_days}d` : ''}${step.delay_hours > 0 ? ` ${step.delay_hours}h` : ''}`
                        : 'Enviar imediatamente'}
                    </p>
                  </div>
                  {isEditable && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 shrink-0 p-0 text-[var(--muted-foreground)] hover:text-red-500"
                      onClick={() => onRemoveStep(step.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {steps.length > 0 && (
          <div className="mt-4 border-t pt-4">
            <p className="mb-2 text-xs font-medium text-[var(--muted-foreground)]">Timeline</p>
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              {steps.map((step, index) => {
                const config = channelConfig[step.channel];
                if (!config) return null;
                const Icon = config.icon;
                return (
                  <div key={step.id} className="flex shrink-0 items-center gap-1">
                    <div className={`flex h-6 w-6 items-center justify-center rounded-full ${config.bgColor}`}>
                      <Icon className={`h-3 w-3 ${config.color}`} />
                    </div>
                    {index < steps.length - 1 && (
                      <div className="flex items-center">
                        <div className="h-px w-6 bg-[var(--border)]" />
                        <span className="text-[10px] text-[var(--muted-foreground)]">
                          {step.delay_days > 0 ? `${step.delay_days}d` : step.delay_hours > 0 ? `${step.delay_hours}h` : '0'}
                        </span>
                        <div className="h-px w-6 bg-[var(--border)]" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
