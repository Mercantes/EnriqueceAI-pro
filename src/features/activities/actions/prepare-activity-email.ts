'use server';

import type { ActionResult } from '@/lib/actions/action-result';
import { requireAuth } from '@/lib/auth/require-auth';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

import { AIService } from '@/features/ai/services/ai.service';
import { buildLeadContext } from '@/features/ai/utils/build-lead-context';
import { buildLeadTemplateVariables } from '@/features/cadences/utils/build-template-variables';
import { renderTemplate } from '@/features/cadences/utils/render-template';

import type { ActivityLead, PreparedEmail, PreparedWhatsApp } from '../types';
import { resolveWhatsAppPhone } from '../utils/resolve-whatsapp-phone';

interface PrepareInput {
  lead: ActivityLead;
  templateSubject: string | null;
  templateBody: string | null;
  aiPersonalization: boolean;
  channel: 'email' | 'whatsapp';
}

async function resolveVendorVariables(userId: string): Promise<{ nome_vendedor: string | null; email_vendedor: string | null }> {
  try {
    const adminClient = createAdminSupabaseClient();
    const { data: vendorUser } = await adminClient.auth.admin.getUserById(userId);
    if (vendorUser?.user) {
      const meta = vendorUser.user.user_metadata as { full_name?: string } | undefined;
      return {
        nome_vendedor: meta?.full_name ?? null,
        email_vendedor: vendorUser.user.email ?? null,
      };
    }
  } catch {
    // Fallback: no vendor data
  }
  return { nome_vendedor: null, email_vendedor: null };
}

export async function prepareActivityEmail(
  input: PrepareInput,
): Promise<ActionResult<PreparedEmail>> {
  const user = await requireAuth();

  const { lead, templateSubject, templateBody, aiPersonalization, channel } = input;

  const toEmail = lead.email ?? '';

  if (!templateBody) {
    return {
      success: true,
      data: {
        to: toEmail,
        subject: templateSubject ?? '',
        body: '',
        aiPersonalized: false,
      },
    };
  }

  const vendorVars = await resolveVendorVariables(user.id);
  const variables: Record<string, string | null> = {
    ...buildLeadTemplateVariables(lead),
    ...vendorVars,
  };

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
      to: toEmail,
      subject,
      body,
      aiPersonalized,
    },
  };
}

export async function prepareActivityWhatsApp(
  input: PrepareInput,
): Promise<ActionResult<PreparedWhatsApp>> {
  const user = await requireAuth();

  const { lead, templateBody, aiPersonalization, channel } = input;

  const resolved = resolveWhatsAppPhone(lead);
  if (!resolved) {
    return { success: false, error: 'Lead sem telefone cadastrado' };
  }

  const phone = resolved.formatted;

  if (!templateBody) {
    return {
      success: true,
      data: {
        to: phone,
        body: '',
        aiPersonalized: false,
      },
    };
  }

  const vendorVars = await resolveVendorVariables(user.id);
  const variables: Record<string, string | null> = {
    ...buildLeadTemplateVariables(lead),
    ...vendorVars,
  };

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
      to: phone,
      body,
      aiPersonalized,
    },
  };
}
