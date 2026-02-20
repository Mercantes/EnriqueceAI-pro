'use client';

import { useState, useTransition } from 'react';
import { Check, Copy, RefreshCw, Save, Sparkles, Wand2 } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Label } from '@/shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Textarea } from '@/shared/components/ui/textarea';

import { generateMessageAction, getAIUsageAction } from '../actions/generate-message';
import type { AIUsageInfo, ChannelTarget, LeadContext, ToneOption } from '../types';

interface AIMessageGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadContext: LeadContext;
  onSaveAsTemplate?: (body: string, subject?: string) => void;
}

const TONE_LABELS: Record<ToneOption, string> = {
  professional: 'Profissional',
  consultative: 'Consultivo',
  direct: 'Direto',
  friendly: 'Amigável',
};

const CHANNEL_LABELS: Record<ChannelTarget, string> = {
  email: 'Email',
  whatsapp: 'WhatsApp',
};

export function AIMessageGenerator({
  open,
  onOpenChange,
  leadContext,
  onSaveAsTemplate,
}: AIMessageGeneratorProps) {
  const [isPending, startTransition] = useTransition();
  const [channel, setChannel] = useState<ChannelTarget>('email');
  const [tone, setTone] = useState<ToneOption>('professional');
  const [additionalContext, setAdditionalContext] = useState('');
  const [generatedSubject, setGeneratedSubject] = useState('');
  const [generatedBody, setGeneratedBody] = useState('');
  const [isGenerated, setIsGenerated] = useState(false);
  const [copied, setCopied] = useState(false);
  const [usage, setUsage] = useState<AIUsageInfo | null>(null);

  function handleGenerate() {
    startTransition(async () => {
      const result = await generateMessageAction({
        channel,
        tone,
        leadContext,
        additionalContext: additionalContext || undefined,
      });

      if (result.success) {
        setGeneratedSubject(result.data.subject ?? '');
        setGeneratedBody(result.data.body);
        setIsGenerated(true);
        toast.success('Mensagem gerada com sucesso');

        // Refresh usage counter
        const usageResult = await getAIUsageAction();
        if (usageResult.success) setUsage(usageResult.data);
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleCopy() {
    const text = channel === 'email' && generatedSubject
      ? `Assunto: ${generatedSubject}\n\n${generatedBody}`
      : generatedBody;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copiado para a área de transferência');
    setTimeout(() => setCopied(false), 2000);
  }

  function handleSaveAsTemplate() {
    onSaveAsTemplate?.(generatedBody, generatedSubject || undefined);
    toast.success('Redirecionando para criar template...');
  }

  function handleReset() {
    setIsGenerated(false);
    setGeneratedSubject('');
    setGeneratedBody('');
    setCopied(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            Gerar Mensagem com IA
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Config row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Canal</Label>
              <Select
                value={channel}
                onValueChange={(v) => { setChannel(v as ChannelTarget); handleReset(); }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(CHANNEL_LABELS) as ChannelTarget[]).map((ch) => (
                    <SelectItem key={ch} value={ch}>
                      {CHANNEL_LABELS[ch]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tom</Label>
              <Select
                value={tone}
                onValueChange={(v) => { setTone(v as ToneOption); handleReset(); }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TONE_LABELS) as ToneOption[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {TONE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Lead context preview */}
          <div className="rounded-md border bg-[var(--muted)] p-3">
            <p className="mb-1 text-xs font-medium text-[var(--muted-foreground)]">Contexto do Lead</p>
            <p className="text-sm font-medium">
              {leadContext.nome_fantasia ?? leadContext.razao_social}
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {leadContext.porte && <Badge variant="outline" className="text-xs">{leadContext.porte}</Badge>}
              {leadContext.cnae && <Badge variant="outline" className="text-xs">{leadContext.cnae}</Badge>}
              {leadContext.endereco?.cidade && (
                <Badge variant="outline" className="text-xs">
                  {leadContext.endereco.cidade}/{leadContext.endereco.uf}
                </Badge>
              )}
            </div>
          </div>

          {/* Additional context */}
          <div className="space-y-2">
            <Label htmlFor="ai-context">Contexto adicional (opcional)</Label>
            <Textarea
              id="ai-context"
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              placeholder="Ex: Oferecer desconto de 20%, mencionar evento do setor..."
              rows={2}
            />
          </div>

          {/* Generate button */}
          {!isGenerated && (
            <Button
              className="w-full"
              onClick={handleGenerate}
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 h-4 w-4" />
                  Gerar Mensagem
                </>
              )}
            </Button>
          )}

          {/* Generated preview */}
          {isGenerated && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Mensagem Gerada</p>
                <Badge variant="secondary" className="text-xs">
                  <Sparkles className="mr-1 h-3 w-3" />
                  IA
                </Badge>
              </div>

              {channel === 'email' && (
                <div className="space-y-1">
                  <Label htmlFor="ai-subject">Assunto</Label>
                  <input
                    id="ai-subject"
                    className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
                    value={generatedSubject}
                    onChange={(e) => setGeneratedSubject(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-1">
                <Label htmlFor="ai-body">Corpo</Label>
                <Textarea
                  id="ai-body"
                  value={generatedBody}
                  onChange={(e) => setGeneratedBody(e.target.value)}
                  rows={8}
                />
              </div>
            </div>
          )}

          {/* Usage counter */}
          {usage && (
            <p className="text-xs text-[var(--muted-foreground)]">
              Uso hoje: {usage.used} / {usage.limit === -1 ? '∞' : usage.limit} gerações
              {usage.remaining !== -1 && ` (${usage.remaining} restantes)`}
            </p>
          )}
        </div>

        {isGenerated && (
          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleGenerate} disabled={isPending}>
              <RefreshCw className={`mr-1 h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
              Regenerar
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? (
                <><Check className="mr-1 h-4 w-4" /> Copiado</>
              ) : (
                <><Copy className="mr-1 h-4 w-4" /> Copiar</>
              )}
            </Button>
            {onSaveAsTemplate && (
              <Button variant="outline" size="sm" onClick={handleSaveAsTemplate}>
                <Save className="mr-1 h-4 w-4" />
                Salvar como Template
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
