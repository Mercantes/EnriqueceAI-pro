'use server';

import type { ActionResult } from '@/lib/actions/action-result';
import { requireAuth } from '@/lib/auth/require-auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

import type { TemplateListResult } from '../index';
import type { MessageTemplateRow } from '../../cadences/types';

interface FetchTemplatesParams {
  channel?: string;
  search?: string;
  is_system?: boolean;
  page?: number;
  per_page?: number;
}

export async function fetchTemplates(
  params: FetchTemplatesParams = {},
): Promise<ActionResult<TemplateListResult>> {
  const user = await requireAuth();
  const supabase = await createServerSupabaseClient();

  const { data: member } = (await supabase
    .from('organization_members')
    .select('org_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()) as { data: { org_id: string } | null };

  if (!member) {
    return { success: false, error: 'Organização não encontrada' };
  }

  const page = params.page ?? 1;
  const per_page = params.per_page ?? 20;
  const from = (page - 1) * per_page;
  const to = from + per_page - 1;

  let query = (supabase
    .from('message_templates') as ReturnType<typeof supabase.from>)
    .select('*', { count: 'exact' })
    .eq('org_id', member.org_id);

  if (params.channel) {
    query = query.eq('channel', params.channel);
  }

  if (params.is_system !== undefined) {
    query = query.eq('is_system', params.is_system);
  }

  if (params.search) {
    query = query.ilike('name', `%${params.search}%`);
  }

  query = query.order('created_at', { ascending: false }).range(from, to);

  const { data, count, error } = (await query) as {
    data: MessageTemplateRow[] | null;
    count: number | null;
    error: { message: string } | null;
  };

  if (error) {
    return { success: false, error: 'Erro ao buscar templates' };
  }

  return {
    success: true,
    data: {
      data: data ?? [],
      total: count ?? 0,
      page,
      per_page,
    },
  };
}

export async function fetchTemplate(
  templateId: string,
): Promise<ActionResult<MessageTemplateRow>> {
  const user = await requireAuth();
  const supabase = await createServerSupabaseClient();

  const { data: member } = (await supabase
    .from('organization_members')
    .select('org_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()) as { data: { org_id: string } | null };

  if (!member) {
    return { success: false, error: 'Organização não encontrada' };
  }

  const { data, error } = (await (supabase
    .from('message_templates') as ReturnType<typeof supabase.from>)
    .select('*')
    .eq('id', templateId)
    .eq('org_id', member.org_id)
    .single()) as { data: MessageTemplateRow | null; error: { message: string } | null };

  if (error || !data) {
    return { success: false, error: 'Template não encontrado' };
  }

  return { success: true, data };
}
