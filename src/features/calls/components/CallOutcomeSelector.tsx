'use client';

import { Label } from '@/shared/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/shared/components/ui/radio-group';
import { cn } from '@/lib/utils';

import { DISPOSITION_OPTIONS, type DispositionOption } from '../disposition';
import type { CallDisposition } from '../types';

export interface CallOutcomeSelectorProps {
  value: CallDisposition | null;
  onChange: (value: CallDisposition) => void;
  disabled?: boolean;
  className?: string;
  /** Opções exibidas — default são todas. O modal passa as filtradas pela telemetria. */
  options?: DispositionOption[];
}

/**
 * Seletor do desfecho da ligação — o que o SDR informa que aconteceu.
 *
 * Composto do átomo RadioGroup (Radix) de propósito: escolha única já vem com
 * navegação por setas, foco visível e rotulagem correta (WCAG AA) sem
 * reimplementar nada.
 *
 * Cada opção mostra o `hint` ("Avança a cadência" / "Reagenda" / "Volta para a
 * fila") porque o desfecho COMANDA o que acontece com a cadência — o SDR
 * precisa ver a consequência antes de escolher, não depois.
 */
export function CallOutcomeSelector({
  value,
  onChange,
  disabled = false,
  className,
  options = DISPOSITION_OPTIONS,
}: CallOutcomeSelectorProps) {
  return (
    <RadioGroup
      // String vazia (não `undefined`) mantém o RadioGroup CONTROLLED quando
      // nada está selecionado — senão o Radix alterna uncontrolled→controlled
      // ao escolher e o React alerta. Nenhum item usa "" como value.
      value={value ?? ''}
      onValueChange={(v) => onChange(v as CallDisposition)}
      disabled={disabled}
      className={cn('grid gap-2 sm:grid-cols-2', className)}
      aria-label="Desfecho da ligação"
    >
      {options.map((option) => {
        const id = `outcome-${option.value}`;
        const selected = value === option.value;
        return (
          <Label
            key={option.value}
            htmlFor={id}
            className={cn(
              'flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-colors',
              'hover:bg-[var(--muted)]',
              selected
                ? 'border-[var(--primary)] bg-[var(--muted)]'
                : 'border-[var(--border)]',
              disabled && 'cursor-not-allowed opacity-60',
            )}
          >
            <RadioGroupItem value={option.value} id={id} className="mt-0.5" />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium leading-none">{option.label}</span>
              <span className="text-xs text-[var(--muted-foreground)] dark:text-[var(--foreground)]">
                {option.hint}
              </span>
            </span>
          </Label>
        );
      })}
    </RadioGroup>
  );
}
