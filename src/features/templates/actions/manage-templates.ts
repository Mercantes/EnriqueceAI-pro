'use server';

import type { ActionResult } from '@/lib/actions/action-result';
import { requireAuth } from '@/lib/auth/require-auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

import { createTemplateSchema, updateTemplateSchema, TEMPLATE_VARIABLE_REGEX } from '../index';
import type { MessageTemplateRow } from '../../cadences/types';

function extractVarsFromText(text: string): string[] {
  return [...new Set([...text.matchAll(TEMPLATE_VARIABLE_REGEX)].map((m) => m[1]).filter((v): v is string => v != null))];
}

async function getOrgId(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, userId: string) {
  const { data: member } = (await supabase
    .from('organization_members')
    .select('org_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single()) as { data: { org_id: string } | null };
  return member?.org_id ?? null;
}

export async function createTemplate(
  input: Record<string, unknown>,
): Promise<ActionResult<MessageTemplateRow>> {
  const user = await requireAuth();
  const supabase = await createServerSupabaseClient();

  const parsed = createTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' };
  }

  const orgId = await getOrgId(supabase, user.id);
  if (!orgId) {
    return { success: false, error: 'Organização não encontrada' };
  }

  const { name, channel, subject, body } = parsed.data;
  const allText = `${subject ?? ''} ${body}`;
  const variables_used = extractVarsFromText(allText);

  const { data, error } = (await (supabase
    .from('message_templates') as ReturnType<typeof supabase.from>)
    .insert({
      org_id: orgId,
      name,
      channel,
      subject: subject ?? null,
      body,
      variables_used,
      is_system: false,
      created_by: user.id,
    } as Record<string, unknown>)
    .select('*')
    .single()) as { data: MessageTemplateRow | null; error: { message: string } | null };

  if (error) {
    return { success: false, error: 'Erro ao criar template' };
  }

  return { success: true, data: data! };
}

export async function updateTemplate(
  templateId: string,
  input: Record<string, unknown>,
): Promise<ActionResult<MessageTemplateRow>> {
  const user = await requireAuth();
  const supabase = await createServerSupabaseClient();

  const parsed = updateTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' };
  }

  const orgId = await getOrgId(supabase, user.id);
  if (!orgId) {
    return { success: false, error: 'Organização não encontrada' };
  }

  // Check template is not system
  const { data: existing } = (await (supabase
    .from('message_templates') as ReturnType<typeof supabase.from>)
    .select('is_system')
    .eq('id', templateId)
    .eq('org_id', orgId)
    .single()) as { data: { is_system: boolean } | null };

  if (!existing) {
    return { success: false, error: 'Template não encontrado' };
  }

  if (existing.is_system) {
    return { success: false, error: 'Templates de sistema não podem ser editados' };
  }

  const updates: Record<string, unknown> = { ...parsed.data };

  // Recalculate variables_used if body or subject changed
  if (parsed.data.body || parsed.data.subject !== undefined) {
    // Need full data to calculate
    const { data: full } = (await (supabase
      .from('message_templates') as ReturnType<typeof supabase.from>)
      .select('subject, body')
      .eq('id', templateId)
      .single()) as { data: { subject: string | null; body: string } | null };

    if (full) {
      const newSubject = parsed.data.subject !== undefined ? parsed.data.subject : full.subject;
      const newBody = parsed.data.body ?? full.body;
      updates.variables_used = extractVarsFromText(`${newSubject ?? ''} ${newBody}`);
    }
  }

  const { data, error } = (await (supabase
    .from('message_templates') as ReturnType<typeof supabase.from>)
    .update(updates as Record<string, unknown>)
    .eq('id', templateId)
    .eq('org_id', orgId)
    .select('*')
    .single()) as { data: MessageTemplateRow | null; error: { message: string } | null };

  if (error) {
    return { success: false, error: 'Erro ao atualizar template' };
  }

  return { success: true, data: data! };
}

export async function deleteTemplate(
  templateId: string,
): Promise<ActionResult<{ deleted: boolean }>> {
  const user = await requireAuth();
  const supabase = await createServerSupabaseClient();

  const orgId = await getOrgId(supabase, user.id);
  if (!orgId) {
    return { success: false, error: 'Organização não encontrada' };
  }

  // Check not system
  const { data: existing } = (await (supabase
    .from('message_templates') as ReturnType<typeof supabase.from>)
    .select('is_system')
    .eq('id', templateId)
    .eq('org_id', orgId)
    .single()) as { data: { is_system: boolean } | null };

  if (!existing) {
    return { success: false, error: 'Template não encontrado' };
  }

  if (existing.is_system) {
    return { success: false, error: 'Templates de sistema não podem ser deletados' };
  }

  const { error } = await (supabase
    .from('message_templates') as ReturnType<typeof supabase.from>)
    .delete()
    .eq('id', templateId)
    .eq('org_id', orgId);

  if (error) {
    return { success: false, error: 'Erro ao deletar template' };
  }

  return { success: true, data: { deleted: true } };
}

export async function duplicateTemplate(
  templateId: string,
): Promise<ActionResult<MessageTemplateRow>> {
  const user = await requireAuth();
  const supabase = await createServerSupabaseClient();

  const orgId = await getOrgId(supabase, user.id);
  if (!orgId) {
    return { success: false, error: 'Organização não encontrada' };
  }

  const { data: source } = (await (supabase
    .from('message_templates') as ReturnType<typeof supabase.from>)
    .select('*')
    .eq('id', templateId)
    .eq('org_id', orgId)
    .single()) as { data: MessageTemplateRow | null };

  if (!source) {
    return { success: false, error: 'Template não encontrado' };
  }

  const { data, error } = (await (supabase
    .from('message_templates') as ReturnType<typeof supabase.from>)
    .insert({
      org_id: orgId,
      name: `${source.name} (cópia)`,
      channel: source.channel,
      subject: source.subject,
      body: source.body,
      variables_used: source.variables_used,
      is_system: false,
      created_by: user.id,
    } as Record<string, unknown>)
    .select('*')
    .single()) as { data: MessageTemplateRow | null; error: { message: string } | null };

  if (error) {
    return { success: false, error: 'Erro ao duplicar template' };
  }

  return { success: true, data: data! };
}
