'use client';

import { useEffect, useState } from 'react';

import { toast } from 'sonner';

import { prepareActivityEmail, prepareActivityWhatsApp } from '../actions/prepare-activity-email';
import type { PendingActivity } from '../types';

import { ActivityEmailCompose } from './ActivityEmailCompose';
import { ActivityPhonePanel } from './ActivityPhonePanel';
import { ActivityResearchPanel } from './ActivityResearchPanel';
import { ActivitySocialPointPanel } from './ActivitySocialPointPanel';
import { ActivityWhatsAppCompose } from './ActivityWhatsAppCompose';

interface ActivityExecutionSheetContentProps {
  activity: PendingActivity;
  isSending: boolean;
  onSend: (subject: string, body: string, aiGenerated: boolean) => void;
  onSkip: () => void;
  onMarkDone: (notes: string) => void;
}

export function ActivityExecutionSheetContent({
  activity,
  isSending,
  onSend,
  onSkip,
  onMarkDone,
}: ActivityExecutionSheetContentProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [subject, setSubject] = useState(activity.templateSubject ?? '');
  const [body, setBody] = useState(activity.templateBody ?? '');
  const [aiPersonalized, setAiPersonalized] = useState(false);
  const [to, setTo] = useState(
    activity.channel === 'whatsapp'
      ? (activity.lead.telefone ?? '')
      : (activity.lead.email ?? ''),
  );

  const leadName = activity.lead.nome_fantasia ?? activity.lead.razao_social ?? activity.lead.cnpj;

  // Fetch prepared message on mount (key prop on parent forces remount per activity)
  useEffect(() => {
    let cancelled = false;

    if (activity.channel === 'whatsapp') {
      prepareActivityWhatsApp({
        lead: activity.lead,
        templateSubject: activity.templateSubject,
        templateBody: activity.templateBody,
        aiPersonalization: activity.aiPersonalization,
        channel: 'whatsapp',
      }).then((result) => {
        if (cancelled) return;
        if (result.success) {
          setTo(result.data.to);
          setBody(result.data.body);
          setAiPersonalized(result.data.aiPersonalized);
        } else {
          toast.error(result.error);
        }
        setIsLoading(false);
      }).catch(() => {
        if (!cancelled) setIsLoading(false);
      });
    } else if (activity.channel === 'email') {
      prepareActivityEmail({
        lead: activity.lead,
        templateSubject: activity.templateSubject,
        templateBody: activity.templateBody,
        aiPersonalization: activity.aiPersonalization,
        channel: activity.channel,
      }).then((result) => {
        if (cancelled) return;
        if (result.success) {
          setTo(result.data.to);
          setSubject(result.data.subject);
          setBody(result.data.body);
          setAiPersonalized(result.data.aiPersonalized);
        } else {
          toast.error(result.error);
        }
        setIsLoading(false);
      }).catch(() => {
        if (!cancelled) setIsLoading(false);
      });
    } else {
      // phone, linkedin, research — no auto-prepare needed
      setIsLoading(false);
    }

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity.enrollmentId]);

  // LinkedIn / Social Point
  if (activity.channel === 'linkedin') {
    return (
      <ActivitySocialPointPanel
        leadName={leadName}
        isSending={isSending}
        onMarkDone={onMarkDone}
        onSkip={onSkip}
      />
    );
  }

  // Research
  if (activity.channel === 'research') {
    return (
      <ActivityResearchPanel
        leadName={leadName}
        isSending={isSending}
        onMarkDone={onMarkDone}
        onSkip={onSkip}
      />
    );
  }

  // Phone
  if (activity.channel === 'phone') {
    return (
      <ActivityPhonePanel
        leadName={leadName}
        phoneNumber={activity.lead.telefone}
        isSending={isSending}
        onMarkDone={onMarkDone}
        onSkip={onSkip}
      />
    );
  }

  // WhatsApp
  if (activity.channel === 'whatsapp') {
    return (
      <ActivityWhatsAppCompose
        to={to}
        body={body}
        aiPersonalized={aiPersonalized}
        isLoading={isLoading}
        isSending={isSending}
        onBodyChange={setBody}
        onSend={() => onSend('', body, aiPersonalized)}
        onSkip={onSkip}
      />
    );
  }

  // Email (default)
  return (
    <ActivityEmailCompose
      to={to}
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
