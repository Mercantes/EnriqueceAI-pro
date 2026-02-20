'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { StickyNote } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Textarea } from '@/shared/components/ui/textarea';

import { updateLead } from '../actions/update-lead';

interface LeadNotesProps {
  leadId: string;
  notes: string | null;
}

export function LeadNotes({ leadId, notes }: LeadNotesProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(notes ?? '');
  const isDirty = value !== (notes ?? '');

  function handleSave() {
    startTransition(async () => {
      const result = await updateLead(leadId, { notes: value || null });
      if (result.success) {
        toast.success('Notas salvas');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <StickyNote className="h-4 w-4" />
            Notas
          </CardTitle>
          {isDirty && (
            <Button size="sm" onClick={handleSave} disabled={isPending}>
              {isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Adicione notas sobre este lead..."
          rows={4}
          className="resize-y"
        />
      </CardContent>
    </Card>
  );
}
