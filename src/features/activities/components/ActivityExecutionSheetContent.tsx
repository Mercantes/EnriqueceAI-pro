'use client';

import { useEffect, useMemo, useState } from 'react';

import { toast } from 'sonner';

import { buildLeadTemplateVariables } from '@/features/cadences/utils/build-template-variables';
import { renderTemplate } from '@/features/cadences/utils/render-template';
import { fetchVendorVariables } from '@/features/cadences/actions/fetch-vendor-variables';

import { prepareActivityEmail, prepareActivityWhatsApp } from '../actions/prepare-activity-email';
import { fetchWhatsAppTemplates, type WhatsAppTemplateOption } from '../actions/fetch-whatsapp-templates';
import { resolveWhatsAppPhone, getAllLeadPhones } from '../utils/resolve-whatsapp-phone';
import type { PendingActivity } from '../types';

import { ActivityEmailCompose } from './ActivityEmailCompose';
import { ActivityPhonePanel } from './ActivityPhonePanel';
import { ActivityResearchPanel } from './ActivityResearchPanel';
import { ActivitySocialPointPanel } from './ActivitySocialPointPanel';
import { ActivityWhatsAppCompose } from './ActivityWhatsAppCompose';

interface ActivityExecutionSheetContentProps {
  activity: PendingActivity;
  isSending: boolean;
  onSend: (subject: string, body: string, aiGenerated: boolean, phone?: string) => void;
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

  // Phone resolution for WhatsApp
  const phones = activity.channel === 'whatsapp' ? getAllLeadPhones(activity.lead) : [];
  const defaultPhone = activity.channel === 'whatsapp'
    ? (resolveWhatsAppPhone(activity.lead)?.formatted ?? '')
    : '';

  const [to, setTo] = useState(
    activity.channel === 'whatsapp'
      ? defaultPhone
      : (activity.lead.email ?? ''),
  );

  // WhatsApp templates
  const [waTemplates, setWaTemplates] = useState<WhatsAppTemplateOption[]>([]);
  const [currentTemplateId, setCurrentTemplateId] = useState<string | null>(activity.templateId);
  const [vendorVars, setVendorVars] = useState<Record<string, string | null>>({});

  const leadName = activity.lead.nome_fantasia ?? activity.lead.razao_social ?? activity.lead.cnpj;

  // Fetch prepared message on mount (key prop on parent forces remount per activity)
  useEffect(() => {
    let cancelled = false;

    // Fetch vendor variables for client-side template rendering
    fetchVendorVariables().then((r) => {
      if (!cancelled && r.success) setVendorVars({ ...r.data });
    });

    if (activity.channel === 'whatsapp') {
      // Fetch templates in parallel with preparing the message
      fetchWhatsAppTemplates().then((result) => {
        if (!cancelled && result.success) {
          setWaTemplates(result.data);
        }
      });

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

  // Compute template variables (lead + vendor)
  const templateVariables = useMemo(
    () => ({ ...buildLeadTemplateVariables(activity.lead), ...vendorVars }),
    [activity.lead, vendorVars],
  );

  // Compute rendered preview by resolving any {{variables}} in the body
  const renderedPreview = useMemo(
    () => renderTemplate(body, templateVariables),
    [body, templateVariables],
  );

  function handleTemplateChange(templateId: string) {
    const tpl = waTemplates.find((t) => t.id === templateId);
    if (!tpl) return;
    setCurrentTemplateId(templateId);

    // Render variables immediately so the textarea shows resolved text
    setBody(renderTemplate(tpl.body, templateVariables));
    setAiPersonalized(false);
  }

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
        renderedPreview={renderedPreview}
        aiPersonalized={aiPersonalized}
        isLoading={isLoading}
        isSending={isSending}
        phones={phones}
        templates={waTemplates}
        currentTemplateId={currentTemplateId}
        onPhoneChange={setTo}
        onBodyChange={setBody}
        onTemplateChange={handleTemplateChange}
        onSend={() => onSend('', renderedPreview, aiPersonalized, to)}
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
