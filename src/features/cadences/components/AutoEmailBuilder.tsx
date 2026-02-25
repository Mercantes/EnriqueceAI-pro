'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ArrowLeft, Mail, Play, Plus, Save } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Textarea } from '@/shared/components/ui/textarea';

import type { CadenceDetail, CadenceMetrics } from '../cadences.contract';
import type { AutoEmailStep } from '../cadence.schemas';
import type { CadenceOrigin, CadencePriority } from '../types';
import { activateCadence, createCadence, updateCadence } from '../actions/manage-cadences';
import { saveAutoEmailSteps } from '../actions/save-auto-email-steps';
import { AutoEmailStepEditor } from './AutoEmailStepEditor';

interface AutoEmailBuilderProps {
  cadence?: CadenceDetail;
  metrics?: CadenceMetrics;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: 'Rascunho', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  active: { label: 'Ativa', className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  paused: { label: 'Pausada', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' },
  archived: { label: 'Arquivada', className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
};

function buildInitialSteps(cadence?: CadenceDetail): AutoEmailStep[] {
  if (!cadence?.steps.length) {
    return [{ subject: '', body: '', delay_days: 0, delay_hours: 0, ai_personalization: false }];
  }
  return cadence.steps.map((s) => ({
    subject: s.template?.subject ?? '',
    body: s.template?.body ?? '',
    delay_days: s.delay_days,
    delay_hours: s.delay_hours,
    ai_personalization: s.ai_personalization,
  }));
}

export function AutoEmailBuilder({ cadence, metrics }: AutoEmailBuilderProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(cadence?.name ?? '');
  const [description, setDescription] = useState(cadence?.description ?? '');
  const [priority, setPriority] = useState<CadencePriority>(cadence?.priority ?? 'medium');
  const [origin, setOrigin] = useState<CadenceOrigin>(cadence?.origin ?? 'outbound');
  const [steps, setSteps] = useState<AutoEmailStep[]>(buildInitialSteps(cadence));

  const isEditing = !!cadence;
  const isEditable = !cadence || cadence.status === 'draft' || cadence.status === 'paused';
  const statusCfg = cadence ? statusConfig[cadence.status] : null;

  function updateStep(index: number, updated: AutoEmailStep) {
    setSteps((prev) => prev.map((s, i) => (i === index ? updated : s)));
  }

  function removeStep(index: number) {
    if (steps.length <= 1) {
      toast.error('A cadência precisa ter pelo menos 1 step');
      return;
    }
    setSteps((prev) => prev.filter((_, i) => i !== index));
  }

  function addStep() {
    setSteps((prev) => [
      ...prev,
      { subject: '', body: '', delay_days: 2, delay_hours: 0, ai_personalization: false },
    ]);
  }

  function handleSave() {
    if (!name.trim()) {
      toast.error('Nome da cadência é obrigatório');
      return;
    }

    // Validate steps
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i]!;
      if (!s.subject.trim()) {
        toast.error(`Step ${i + 1}: Assunto é obrigatório`);
        return;
      }
      if (!s.body.trim()) {
        toast.error(`Step ${i + 1}: Corpo do email é obrigatório`);
        return;
      }
    }

    startTransition(async () => {
      let cadenceId = cadence?.id;

      if (!isEditing) {
        // Create cadence first
        const createResult = await createCadence({
          name,
          description: description || null,
          type: 'auto_email',
        });
        if (!createResult.success) {
          toast.error(createResult.error);
          return;
        }
        cadenceId = createResult.data.id;
      } else {
        // Update cadence metadata
        const updateResult = await updateCadence(cadence.id, {
          name,
          description: description || null,
        });
        if (!updateResult.success) {
          toast.error(updateResult.error);
          return;
        }
      }

      // Save steps
      const saveResult = await saveAutoEmailSteps({
        cadence_id: cadenceId!,
        steps,
      });

      if (!saveResult.success) {
        toast.error(saveResult.error);
        return;
      }

      toast.success(isEditing ? 'Cadência atualizada' : 'Cadência criada');
      if (!isEditing) {
        router.push(`/cadences/${cadenceId}`);
      } else {
        router.refresh();
      }
    });
  }

  function handleActivate() {
    if (!cadence) return;
    if (steps.length < 2) {
      toast.error('Cadência precisa de no mínimo 2 steps para ser ativada');
      return;
    }
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
        <Button variant="ghost" size="sm" onClick={() => router.push('/cadences?type=auto_email')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-purple-500" />
          <h1 className="text-2xl font-bold">
            {isEditing ? 'Editar E-mail Automático' : 'Novo E-mail Automático'}
          </h1>
        </div>
        {statusCfg && (
          <Badge variant="outline" className={statusCfg.className}>
            {statusCfg.label}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
        {/* Sidebar — Config */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configuração</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="cadence-name">Nome</Label>
                <Input
                  id="cadence-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Prospecção Outbound Q1"
                  disabled={!isEditable}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cadence-desc">Descrição</Label>
                <Textarea
                  id="cadence-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descrição opcional..."
                  rows={3}
                  disabled={!isEditable}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Prioridade</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as CadencePriority)} disabled={!isEditable}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="low">Baixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Origem</Label>
                <Select value={origin} onValueChange={(v) => setOrigin(v as CadenceOrigin)} disabled={!isEditable}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="outbound">Outbound</SelectItem>
                    <SelectItem value="inbound_active">Inbound Ativo</SelectItem>
                    <SelectItem value="inbound_passive">Inbound Passivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Metrics (edit mode only) */}
          {metrics && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Métricas</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-[var(--muted-foreground)]">Inscritos</p>
                  <p className="text-lg font-semibold">{metrics.total_enrolled}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted-foreground)]">Em progresso</p>
                  <p className="text-lg font-semibold">{metrics.in_progress}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted-foreground)]">Responderam</p>
                  <p className="text-lg font-semibold text-green-600">{metrics.replied}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted-foreground)]">Completaram</p>
                  <p className="text-lg font-semibold">{metrics.completed}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2">
            {isEditable && (
              <Button onClick={handleSave} disabled={isPending}>
                <Save className="mr-2 h-4 w-4" />
                {isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            )}
            {isEditing && cadence.status === 'draft' && (
              <Button variant="outline" onClick={handleActivate} disabled={isPending}>
                <Play className="mr-2 h-4 w-4" />
                Ativar Cadência
              </Button>
            )}
          </div>
        </div>

        {/* Main — Steps */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Sequência de Emails ({steps.length} step{steps.length !== 1 ? 's' : ''})
            </h2>
          </div>

          {steps.map((step, index) => (
            <AutoEmailStepEditor
              key={index}
              step={step}
              stepNumber={index + 1}
              isFirst={index === 0}
              onChange={(updated) => updateStep(index, updated)}
              onRemove={() => removeStep(index)}
              cadenceId={cadence?.id}
            />
          ))}

          {isEditable && (
            <Button variant="outline" className="w-full" onClick={addStep}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Step
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
