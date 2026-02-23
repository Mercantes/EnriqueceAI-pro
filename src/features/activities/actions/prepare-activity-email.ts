'use server';

import type { ActionResult } from '@/lib/actions/action-result';
import { requireAuth } from '@/lib/auth/require-auth';

import { AIService } from '@/features/ai/services/ai.service';
import type { LeadContext } from '@/features/ai/types';
import { cleanCompanyName } from '@/features/cadences/utils/clean-company-name';
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

  // Render template variables
  const variables: Record<string, string | null> = {
    primeiro_nome: lead.primeiro_nome,
    empresa: cleanCompanyName(lead.nome_fantasia ?? lead.razao_social),
    nome_fantasia: lead.nome_fantasia,
    razao_social: lead.razao_social,
    cnpj: lead.cnpj,
    email: lead.email,
    telefone: lead.telefone,
    municipio: lead.municipio,
    uf: lead.uf,
    porte: lead.porte,
  };

  let body = renderTemplate(templateBody, variables);
  let subject = templateSubject ? renderTemplate(templateSubject, variables) : '';
  let aiPersonalized = false;

  // AI personalization when enabled
  if (aiPersonalization && body) {
    try {
      const leadContext: LeadContext = {
        nome_fantasia: lead.nome_fantasia,
        razao_social: lead.razao_social,
        cnpj: lead.cnpj,
        email: lead.email,
        telefone: lead.telefone,
        porte: lead.porte,
        cnae: null,
        situacao_cadastral: null,
        faturamento_estimado: null,
        endereco: lead.municipio
          ? { cidade: lead.municipio, uf: lead.uf ?? undefined }
          : null,
      };

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

  const variables: Record<string, string | null> = {
    primeiro_nome: lead.primeiro_nome,
    empresa: cleanCompanyName(lead.nome_fantasia ?? lead.razao_social),
    nome_fantasia: lead.nome_fantasia,
    razao_social: lead.razao_social,
    cnpj: lead.cnpj,
    email: lead.email,
    telefone: lead.telefone,
    municipio: lead.municipio,
    uf: lead.uf,
    porte: lead.porte,
  };

  let body = renderTemplate(templateBody, variables);
  let aiPersonalized = false;

  if (aiPersonalization && body) {
    try {
      const leadContext: LeadContext = {
        nome_fantasia: lead.nome_fantasia,
        razao_social: lead.razao_social,
        cnpj: lead.cnpj,
        email: lead.email,
        telefone: lead.telefone,
        porte: lead.porte,
        cnae: null,
        situacao_cadastral: null,
        faturamento_estimado: null,
        endereco: lead.municipio
          ? { cidade: lead.municipio, uf: lead.uf ?? undefined }
          : null,
      };

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
