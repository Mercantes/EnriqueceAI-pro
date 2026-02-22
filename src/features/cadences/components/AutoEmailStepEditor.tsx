'use client';

import { useCallback, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { ChevronDown, ChevronRight, Sparkles, Trash2 } from 'lucide-react';

import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Switch } from '@/shared/components/ui/switch';

import type { AutoEmailStep } from '../cadence.schemas';
import { VariableInsertBar } from './VariableInsertBar';

interface AutoEmailStepEditorProps {
  step: AutoEmailStep;
  stepNumber: number;
  isFirst: boolean;
  onChange: (step: AutoEmailStep) => void;
  onRemove: () => void;
}

export function AutoEmailStepEditor({
  step,
  stepNumber,
  isFirst,
  onChange,
  onRemove,
}: AutoEmailStepEditorProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [focusedField, setFocusedField] = useState<'subject' | 'body'>('body');
  const subjectRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Escreva o corpo do email...',
      }),
    ],
    content: step.body,
    onUpdate: ({ editor: e }) => {
      onChange({ ...step, body: e.getHTML() });
    },
    onFocus: () => setFocusedField('body'),
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none min-h-[120px] p-3 focus:outline-none [&_p]:my-1',
      },
    },
  });

  const handleInsertVariable = useCallback(
    (variable: string) => {
      const insertion = `{{${variable}}}`;
      if (focusedField === 'subject' && subjectRef.current) {
        const input = subjectRef.current;
        const start = input.selectionStart ?? input.value.length;
        const end = input.selectionEnd ?? start;
        const newValue = input.value.slice(0, start) + insertion + input.value.slice(end);
        onChange({ ...step, subject: newValue });
        requestAnimationFrame(() => {
          input.focus();
          input.setSelectionRange(start + insertion.length, start + insertion.length);
        });
      } else if (focusedField === 'body' && editor) {
        editor.chain().focus().insertContent(insertion).run();
      }
    },
    [focusedField, editor, onChange, step],
  );

  const delayLabel = isFirst
    ? 'Imediato'
    : step.delay_days > 0 || step.delay_hours > 0
      ? `${step.delay_days}d ${step.delay_hours}h`
      : 'Imediato';

  return (
    <div className="rounded-lg border">
      {/* Header */}
      <div className="flex items-center gap-2 rounded-t-lg bg-[var(--muted)] px-4 py-2.5">
        <button type="button" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? (
            <ChevronRight className="h-4 w-4 text-[var(--muted-foreground)]" />
          ) : (
            <ChevronDown className="h-4 w-4 text-[var(--muted-foreground)]" />
          )}
        </button>
        <span className="text-sm font-medium">Step {stepNumber}</span>
        <Badge variant="outline" className="text-xs">
          {delayLabel}
        </Badge>
        {step.ai_personalization && (
          <Badge variant="secondary" className="gap-1 text-xs">
            <Sparkles className="h-3 w-3" />
            IA
          </Badge>
        )}
        <span className="flex-1 truncate text-xs text-[var(--muted-foreground)]">
          {step.subject || 'Sem assunto'}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-[var(--muted-foreground)] hover:text-red-500"
          onClick={onRemove}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Content */}
      {!collapsed && (
        <div className="space-y-4 p-4">
          {/* Delay (hidden for first step) */}
          {!isFirst && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor={`delay-days-${stepNumber}`} className="text-xs whitespace-nowrap">
                  Esperar
                </Label>
                <Input
                  id={`delay-days-${stepNumber}`}
                  type="number"
                  min={0}
                  value={step.delay_days}
                  onChange={(e) =>
                    onChange({ ...step, delay_days: parseInt(e.target.value, 10) || 0 })
                  }
                  className="w-16 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <span className="text-xs text-[var(--muted-foreground)]">dias</span>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={step.delay_hours}
                  onChange={(e) =>
                    onChange({ ...step, delay_hours: parseInt(e.target.value, 10) || 0 })
                  }
                  className="w-16 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <span className="text-xs text-[var(--muted-foreground)]">horas</span>
              </div>
            </div>
          )}

          {/* Subject */}
          <div className="space-y-1.5">
            <Label htmlFor={`subject-${stepNumber}`} className="text-sm">
              Assunto
            </Label>
            <Input
              ref={subjectRef}
              id={`subject-${stepNumber}`}
              value={step.subject}
              onChange={(e) => onChange({ ...step, subject: e.target.value })}
              onFocus={() => setFocusedField('subject')}
              placeholder="Ex: {{nome_fantasia}}, temos uma oportunidade para você"
            />
          </div>

          {/* Body (TipTap) */}
          <div className="space-y-1.5">
            <Label className="text-sm">Corpo do Email</Label>
            <div className="rounded-md border focus-within:ring-1 focus-within:ring-[var(--ring)]">
              <EditorContent editor={editor} />
            </div>
          </div>

          {/* Variable insert bar */}
          <VariableInsertBar onInsert={handleInsertVariable} />

          {/* AI toggle */}
          <div className="flex items-center gap-2">
            <Switch
              id={`ai-${stepNumber}`}
              checked={step.ai_personalization}
              onCheckedChange={(checked: boolean) => onChange({ ...step, ai_personalization: checked })}
            />
            <Label htmlFor={`ai-${stepNumber}`} className="flex items-center gap-1.5 text-sm">
              <Sparkles className="h-3.5 w-3.5 text-purple-500" />
              Personalização com IA
            </Label>
          </div>
        </div>
      )}
    </div>
  );
}
