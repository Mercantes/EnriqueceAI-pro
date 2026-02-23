'use client';

import { useState } from 'react';

import { Clock, Eye, Loader2, Pencil, Send, Sparkles } from 'lucide-react';

import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';

interface ActivityEmailComposeProps {
  to: string;
  subject: string;
  body: string;
  aiPersonalized: boolean;
  isLoading: boolean;
  isSending: boolean;
  onSubjectChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onSend: () => void;
  onSkip: () => void;
}

export function ActivityEmailCompose({
  to,
  subject,
  body,
  aiPersonalized,
  isLoading,
  isSending,
  onSubjectChange,
  onBodyChange,
  onSend,
  onSkip,
}: ActivityEmailComposeProps) {
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('preview');
  const canSend = !isSending && !isLoading && to && subject.trim() && body.trim();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
          Compor Email
        </h3>
        <div className="flex items-center gap-2">
          {aiPersonalized && (
            <Badge variant="outline" className="gap-1 text-xs">
              <Sparkles className="h-3 w-3" />
              Personalizado por IA
            </Badge>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--muted-foreground)]" />
          <span className="ml-2 text-sm text-[var(--muted-foreground)]">Preparando email...</span>
        </div>
      ) : (
        <>
          <div className="mt-3 space-y-3 flex-1">
            {/* To field (read-only) */}
            <div className="space-y-1">
              <Label className="text-xs">Para</Label>
              <Input
                value={to}
                readOnly
                className="bg-[var(--muted)]"
                placeholder={!to ? 'Lead sem email cadastrado' : undefined}
              />
            </div>

            {/* Subject */}
            <div className="space-y-1">
              <Label className="text-xs">Assunto</Label>
              <Input
                value={subject}
                onChange={(e) => onSubjectChange(e.target.value)}
                placeholder="Assunto do email"
              />
            </div>

            {/* Body with Edit/Preview toggle */}
            <div className="flex flex-1 flex-col space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Mensagem</Label>
                <div className="flex rounded-md border border-[var(--border)] text-xs">
                  <button
                    type="button"
                    onClick={() => setViewMode('edit')}
                    className={`flex items-center gap-1 px-2.5 py-1 transition-colors ${
                      viewMode === 'edit'
                        ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                        : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                    }`}
                  >
                    <Pencil className="h-3 w-3" />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('preview')}
                    className={`flex items-center gap-1 px-2.5 py-1 transition-colors ${
                      viewMode === 'preview'
                        ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                        : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                    }`}
                  >
                    <Eye className="h-3 w-3" />
                    Preview
                  </button>
                </div>
              </div>

              {viewMode === 'edit' ? (
                <Textarea
                  value={body}
                  onChange={(e) => onBodyChange(e.target.value)}
                  placeholder="Corpo do email"
                  className="min-h-[200px] flex-1 resize-none font-mono text-xs"
                />
              ) : (
                <div
                  className="min-h-[200px] flex-1 overflow-auto rounded-md border border-[var(--border)] bg-white p-4 text-sm dark:bg-[var(--card)]"
                  dangerouslySetInnerHTML={{ __html: body }}
                />
              )}
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
              Enviar Email
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
