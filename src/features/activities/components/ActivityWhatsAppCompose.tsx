'use client';

import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';

import { Clock, Loader2, MessageSquare, Send, Sparkles } from 'lucide-react';

interface ActivityWhatsAppComposeProps {
  to: string;
  body: string;
  aiPersonalized: boolean;
  isLoading: boolean;
  isSending: boolean;
  onBodyChange: (value: string) => void;
  onSend: () => void;
  onSkip: () => void;
}

export function ActivityWhatsAppCompose({
  to,
  body,
  aiPersonalized,
  isLoading,
  isSending,
  onBodyChange,
  onSend,
  onSkip,
}: ActivityWhatsAppComposeProps) {
  const canSend = !isSending && !isLoading && to && body.trim();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
          Compor WhatsApp
        </h3>
        {aiPersonalized && (
          <Badge variant="outline" className="gap-1 text-xs">
            <Sparkles className="h-3 w-3" />
            Personalizado por IA
          </Badge>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--muted-foreground)]" />
          <span className="ml-2 text-sm text-[var(--muted-foreground)]">Preparando mensagem...</span>
        </div>
      ) : (
        <>
          <div className="mt-3 space-y-3 flex-1">
            {/* To field (read-only) */}
            <div className="space-y-1">
              <Label className="text-xs">Para (telefone)</Label>
              <Input value={to} readOnly className="bg-[var(--muted)]" />
            </div>

            {/* Body */}
            <div className="flex flex-1 flex-col space-y-1">
              <Label className="text-xs">Mensagem</Label>
              <Textarea
                value={body}
                onChange={(e) => onBodyChange(e.target.value)}
                placeholder="Mensagem WhatsApp"
                className="min-h-[200px] flex-1 resize-none"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="mt-4 flex items-center justify-end gap-2 border-t border-[var(--border)] pt-4">
            <Button variant="outline" onClick={onSkip} disabled={isSending}>
              <Clock className="mr-2 h-4 w-4" />
              Pular
            </Button>
            <Button onClick={onSend} disabled={!canSend}>
              {isSending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              <MessageSquare className="mr-1 h-4 w-4" />
              Enviar WhatsApp
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
