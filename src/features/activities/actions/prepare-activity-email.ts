'use server';

import type { ActionResult } from '@/lib/actions/action-result';
import { requireAuth } from '@/lib/auth/require-auth';

import { AIService } from '@/features/ai/services/ai.service';
import { buildLeadContext } from '@/features/ai/utils/build-lead-context';
import { buildLeadTemplateVariables } from '@/features/cadences/utils/build-template-variables';
import { renderTemplate } from '@/features/cadences/utils/render-template';

import type { ActivityLead, PreparedEmail, PreparedWhatsApp } from '../types';

interface PrepareInput {
  lead: ActivityLead;
  templateSubject: string | null;
  templateBody: string | null;
  aiPersonalization: boolean;
  channel: 'email' | 'whatsapp';
}

export async function prepareActivityEmail(
  input: PrepareInput,
): Promise<ActionResult<PreparedEmail>> {
  await requireAuth();

  const { lead, templateSubject, templateBody, aiPersonalization, channel } = input;

  if (!lead.email) {
    return { success: false, error: 'Lead sem email cadastrado' };
  }

  if (!templateBody) {
    return {
      success: true,
      data: {
        to: lead.email,
        subject: templateSubject ?? '',
        body: '',
        aiPersonalized: false,
      },
    };
  }

  const variables = buildLeadTemplateVariables(lead);

  let body = renderTemplate(templateBody, variables);
  let subject = templateSubject ? renderTemplate(templateSubject, variables) : '';
  let aiPersonalized = false;

  if (aiPersonalization && body) {
    try {
      const leadContext = buildLeadContext(lead);
      const aiResult = await AIService.personalizeMessage(
        channel,
        body,
        leadContext,
        lead.org_id,
      );
      body = aiResult.body;
      if (aiResult.subject) {
        subject = aiResult.subject;
      }
      aiPersonalized = true;
    } catch (aiError) {
      console.error('[activities] AI personalization failed, using template fallback:', aiError);
    }
  }

  return {
    success: true,
    data: {
      to: lead.email,
      subject,
      body,
      aiPersonalized,
    },
  };
}

export async function prepareActivityWhatsApp(
  input: PrepareInput,
): Promise<ActionResult<PreparedWhatsApp>> {
  await requireAuth();

  const { lead, templateBody, aiPersonalization, channel } = input;

  if (!lead.telefone) {
    return { success: false, error: 'Lead sem telefone cadastrado' };
  }

  if (!templateBody) {
    return {
      success: true,
      data: {
        to: lead.telefone,
        body: '',
        aiPersonalized: false,
      },
    };
  }

  const variables = buildLeadTemplateVariables(lead);

  let body = renderTemplate(templateBody, variables);
  let aiPersonalized = false;

  if (aiPersonalization && body) {
    try {
      const leadContext = buildLeadContext(lead);
      const aiResult = await AIService.personalizeMessage(
        channel,
        body,
        leadContext,
        lead.org_id,
      );
      body = aiResult.body;
      aiPersonalized = true;
    } catch (aiError) {
      console.error('[activities] AI personalization failed, using template fallback:', aiError);
    }
  }

  return {
    success: true,
    data: {
      to: lead.telefone,
      body,
      aiPersonalized,
    },
  };
}
