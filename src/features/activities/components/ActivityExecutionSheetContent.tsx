'use client';

import { useState } from 'react';

import { toast } from 'sonner';

import { prepareActivityEmail } from '../actions/prepare-activity-email';
import type { PendingActivity } from '../types';

import { ActivityEmailCompose } from './ActivityEmailCompose';

interface ActivityExecutionSheetContentProps {
  activity: PendingActivity;
  isSending: boolean;
  onSend: (subject: string, body: string, aiGenerated: boolean) => void;
  onSkip: () => void;
}

export function ActivityExecutionSheetContent({
  activity,
  isSending,
  onSend,
  onSkip,
}: ActivityExecutionSheetContentProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [subject, setSubject] = useState(activity.templateSubject ?? '');
  const [body, setBody] = useState(activity.templateBody ?? '');
  const [aiPersonalized, setAiPersonalized] = useState(false);

  // Fire-and-forget fetch on mount (key prop on parent forces remount per activity)
  useState(() => {
    prepareActivityEmail({
      lead: activity.lead,
      templateSubject: activity.templateSubject,
      templateBody: activity.templateBody,
      aiPersonalization: activity.aiPersonalization,
      channel: activity.channel,
    }).then((result) => {
      if (result.success) {
        setSubject(result.data.subject);
        setBody(result.data.body);
        setAiPersonalized(result.data.aiPersonalized);
      } else {
        toast.error(result.error);
      }
      setIsLoading(false);
    }).catch(() => {
      setIsLoading(false);
    });
    return null;
  });

  return (
    <ActivityEmailCompose
      to={activity.lead.email ?? ''}
      subject={subject}
      body={body}
      aiPersonalized={aiPersonalized}
      isLoading={isLoading}
      isSending={isSending}
      onSubjectChange={setSubject}
      onBodyChange={setBody}
      onSend={() => onSend(subject, body, aiPersonalized)}
      onSkip={onSkip}
    />
  );
}
