'use client';

import { ArrowRight } from 'lucide-react';

import { Card, CardContent } from '@/shared/components/ui/card';

import type { StageConversion } from '../types/conversion-analytics.types';

interface StageToStageCardsProps {
  conversions: StageConversion[];
}

export function StageToStageCards({ conversions }: StageToStageCardsProps) {
  if (conversions.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {conversions.map((conv) => (
        <Card key={`${conv.from}-${conv.to}`}>
          <CardContent className="p-4">
            <div className="mb-2 flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
              <span className="truncate">{conv.from}</span>
              <ArrowRight className="h-3 w-3 shrink-0" />
              <span className="truncate">{conv.to}</span>
            </div>
            <p className="text-2xl font-bold">{conv.rate}%</p>
            <p className="text-xs text-[var(--muted-foreground)]">
              {conv.numerator} de {conv.denominator}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
