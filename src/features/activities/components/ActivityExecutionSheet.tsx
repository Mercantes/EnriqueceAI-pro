'use client';

import { useTransition } from 'react';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/shared/components/ui/sheet';

import { executeActivity } from '../actions/execute-activity';
import { skipActivity } from '../actions/skip-activity';
import type { PendingActivity } from '../types';

import { ActivityLeadContext } from './ActivityLeadContext';
import { ActivityExecutionSheetContent } from './ActivityExecutionSheetContent';

interface ActivityExecutionSheetProps {
  activities: PendingActivity[];
  selectedIndex: number | null;
  onClose: () => void;
  onNavigate: (index: number) => void;
  onActivityDone: (enrollmentId: string) => void;
}

export function ActivityExecutionSheet({
  activities,
  selectedIndex,
  onClose,
  onNavigate,
  onActivityDone,
}: ActivityExecutionSheetProps) {
  const [isSending, startSendTransition] = useTransition();

  const activity = selectedIndex !== null ? activities[selectedIndex] : null;

  // Advance to next activity or close if last
  function advanceOrClose(enrollmentId: string) {
    onActivityDone(enrollmentId);

    if (selectedIndex !== null && selectedIndex < activities.length - 1) {
      onNavigate(selectedIndex);
    } else {
      onClose();
    }
  }

  const handleSend = (subject: string, body: string, aiGenerated: boolean) => {
    if (!activity || !activity.cadenceCreatedBy) {
      toast.error('Cadência sem usuário criador — não é possível enviar');
      return;
    }

    const isWhatsApp = activity.channel === 'whatsapp';
    const to = isWhatsApp
      ? (activity.lead.telefone ?? '')
      : (activity.lead.email ?? '');

    startSendTransition(async () => {
      const result = await executeActivity({
        enrollmentId: activity.enrollmentId,
        cadenceId: activity.cadenceId,
        stepId: activity.stepId,
        leadId: activity.lead.id,
        orgId: activity.lead.org_id,
        cadenceCreatedBy: activity.cadenceCreatedBy!,
        channel: activity.channel,
        to,
        subject,
        body,
        aiGenerated,
        templateId: activity.templateId,
      });

      if (result.success) {
        toast.success(isWhatsApp ? 'WhatsApp enviado com sucesso!' : 'Email enviado com sucesso!');
        advanceOrClose(activity.enrollmentId);
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleMarkDone = (notes: string) => {
    if (!activity) return;

    startSendTransition(async () => {
      const result = await executeActivity({
        enrollmentId: activity.enrollmentId,
        cadenceId: activity.cadenceId,
        stepId: activity.stepId,
        leadId: activity.lead.id,
        orgId: activity.lead.org_id,
        cadenceCreatedBy: activity.cadenceCreatedBy ?? '',
        channel: activity.channel,
        to: '',
        subject: '',
        body: notes,
        aiGenerated: false,
        templateId: null,
      });

      if (result.success) {
        toast.success('Atividade marcada como feita!');
        advanceOrClose(activity.enrollmentId);
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleSkip = () => {
    if (!activity) return;

    startSendTransition(async () => {
      const result = await skipActivity(activity.enrollmentId);

      if (result.success) {
        toast.success('Atividade adiada em 2 horas');
        advanceOrClose(activity.enrollmentId);
      } else {
        toast.error(result.error);
      }
    });
  };

  const hasPrev = selectedIndex !== null && selectedIndex > 0;
  const hasNext = selectedIndex !== null && selectedIndex < activities.length - 1;

  return (
    <Sheet open={selectedIndex !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="sm:max-w-5xl w-full p-0 flex flex-col">
        {/* Header with navigation */}
        <SheetHeader className="flex-row items-center justify-between border-b border-[var(--border)] px-6 py-4 space-y-0">
          <SheetTitle className="text-base font-semibold">
            Executar Atividade
          </SheetTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={!hasPrev}
              onClick={() => selectedIndex !== null && onNavigate(selectedIndex - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm tabular-nums text-[var(--muted-foreground)]">
              {selectedIndex !== null ? selectedIndex + 1 : 0} de {activities.length}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={!hasNext}
              onClick={() => selectedIndex !== null && onNavigate(selectedIndex + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        {/* Split layout — key forces remount when activity changes */}
        {activity && (
          <div className="flex flex-1 overflow-hidden">
            {/* Left — Lead Context with tabs */}
            <div className="w-[320px] shrink-0 border-r border-[var(--border)] overflow-y-auto p-5">
              <ActivityLeadContext
                lead={activity.lead}
                cadenceName={activity.cadenceName}
                stepOrder={activity.stepOrder}
                totalSteps={activity.totalSteps}
              />
            </div>

            {/* Right — Activity panel (adapts by type) */}
            <div className="flex-1 overflow-y-auto p-5">
              <ActivityExecutionSheetContent
                key={activity.enrollmentId}
                activity={activity}
                isSending={isSending}
                onSend={handleSend}
                onSkip={handleSkip}
                onMarkDone={handleMarkDone}
              />
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
