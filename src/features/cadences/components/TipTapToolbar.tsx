'use client';

import type { Editor } from '@tiptap/react';
import {
  Bold,
  Braces,
  Heading,
  Italic,
  Link,
  Sparkles,
} from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { Separator } from '@/shared/components/ui/separator';

import {
  AVAILABLE_TEMPLATE_VARIABLES,
  VENDOR_TEMPLATE_VARIABLES,
} from '../cadence.schemas';

interface TipTapToolbarProps {
  editor: Editor | null;
  onInsertVariable: (variable: string) => void;
  onOpenAI: () => void;
  disabled?: boolean;
}

const VARIABLE_LABELS: Record<string, string> = {
  primeiro_nome: 'Primeiro nome',
  empresa: 'Empresa',
  telefone: 'Telefone',
  nome_vendedor: 'Nome vendedor',
  email_vendedor: 'E-mail vendedor',
};

export function TipTapToolbar({
  editor,
  onInsertVariable,
  onOpenAI,
  disabled,
}: TipTapToolbarProps) {
  if (!editor) return null;

  function handleLink() {
    if (!editor) return;

    const previousUrl = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('URL:', previousUrl ?? 'https://');

    if (url === null) return;

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }

  return (
    <div className="flex items-center gap-0.5 border-t px-2 py-1.5">
      {/* AI */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5 px-2 text-purple-600 hover:text-purple-700"
        onClick={onOpenAI}
        disabled={disabled}
      >
        <Sparkles className="h-4 w-4" />
        <span className="text-xs font-medium">Escrever com IA</span>
      </Button>

      <Separator orientation="vertical" className="mx-1 h-5" />

      {/* Bold */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={`h-8 w-8 p-0 ${editor.isActive('bold') ? 'bg-[var(--accent)]' : ''}`}
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={disabled}
        title="Negrito"
      >
        <Bold className="h-4 w-4" />
      </Button>

      {/* Italic */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={`h-8 w-8 p-0 ${editor.isActive('italic') ? 'bg-[var(--accent)]' : ''}`}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={disabled}
        title="Itálico"
      >
        <Italic className="h-4 w-4" />
      </Button>

      {/* Heading dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={`h-8 w-8 p-0 ${
              editor.isActive('heading') ? 'bg-[var(--accent)]' : ''
            }`}
            disabled={disabled}
            title="Título"
          >
            <Heading className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          >
            <span className="text-lg font-bold">Título 1</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            <span className="text-base font-bold">Título 2</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          >
            <span className="text-sm font-bold">Título 3</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Link */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={`h-8 w-8 p-0 ${editor.isActive('link') ? 'bg-[var(--accent)]' : ''}`}
        onClick={handleLink}
        disabled={disabled}
        title="Link"
      >
        <Link className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="mx-1 h-5" />

      {/* Variables dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 px-2"
            disabled={disabled}
            title="Inserir variável"
          >
            <Braces className="h-4 w-4" />
            <span className="text-xs">Variáveis</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuLabel className="text-xs text-[var(--muted-foreground)]">
            Lead
          </DropdownMenuLabel>
          {AVAILABLE_TEMPLATE_VARIABLES.map((v) => (
            <DropdownMenuItem key={v} onClick={() => onInsertVariable(v)}>
              <code className="mr-2 text-xs text-purple-600">{`{{${v}}}`}</code>
              <span className="text-xs text-[var(--muted-foreground)]">
                {VARIABLE_LABELS[v] ?? v}
              </span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs text-[var(--muted-foreground)]">
            Vendedor
          </DropdownMenuLabel>
          {VENDOR_TEMPLATE_VARIABLES.map((v) => (
            <DropdownMenuItem key={v} onClick={() => onInsertVariable(v)}>
              <code className="mr-2 text-xs text-purple-600">{`{{${v}}}`}</code>
              <span className="text-xs text-[var(--muted-foreground)]">
                {VARIABLE_LABELS[v] ?? v}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
