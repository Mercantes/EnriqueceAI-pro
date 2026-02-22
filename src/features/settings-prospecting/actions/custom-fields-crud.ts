'use server';

import type { ActionResult } from '@/lib/actions/action-result';
import { requireManager } from '@/lib/auth/require-manager';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface CustomFieldRow {
  id: string;
  org_id: string;
  field_name: string;
  field_type: 'text' | 'number' | 'date' | 'select';
  options: string[] | null;
  sort_order: number;
  created_at: string;
}

async function getOrgId() {
  const user = await requireManager();
  const supabase = await createServerSupabaseClient();

  const { data: member } = (await supabase
    .from('organization_members')
    .select('org_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()) as { data: { org_id: string } | null };

  return { orgId: member?.org_id ?? null, supabase };
}

function customFieldsFrom(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  return supabase.from('custom_fields' as never) as ReturnType<typeof supabase.from>;
}

export async function listCustomFields(): Promise<ActionResult<CustomFieldRow[]>> {
  const { orgId, supabase } = await getOrgId();
  if (!orgId) return { success: false, error: 'Organização não encontrada' };

  const { data, error } = (await customFieldsFrom(supabase)
    .select('*')
    .eq('org_id', orgId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })) as { data: CustomFieldRow[] | null; error: unknown };

  if (error) return { success: false, error: 'Erro ao listar campos personalizados' };
  return { success: true, data: data ?? [] };
}

export async function addCustomField(
  fieldName: string,
  fieldType: 'text' | 'number' | 'date' | 'select',
  options?: string[],
): Promise<ActionResult<CustomFieldRow>> {
  const { orgId, supabase } = await getOrgId();
  if (!orgId) return { success: false, error: 'Organização não encontrada' };

  const trimmed = fieldName.trim();
  if (!trimmed) return { success: false, error: 'Nome do campo é obrigatório' };

  if (fieldType === 'select' && (!options || options.length === 0)) {
    return { success: false, error: 'Campos do tipo select precisam de pelo menos uma opção' };
  }

  const { data: maxRow } = (await customFieldsFrom(supabase)
    .select('sort_order')
    .eq('org_id', orgId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single()) as { data: { sort_order: number } | null };

  const nextOrder = (maxRow?.sort_order ?? 0) + 1;

  const { data, error } = (await customFieldsFrom(supabase)
    .insert({
      org_id: orgId,
      field_name: trimmed,
      field_type: fieldType,
      options: fieldType === 'select' ? options : null,
      sort_order: nextOrder,
    })
    .select()
    .single()) as { data: CustomFieldRow | null; error: unknown };

  if (error || !data) return { success: false, error: 'Erro ao adicionar campo' };
  return { success: true, data };
}

export async function updateCustomField(
  id: string,
  fieldName: string,
  fieldType: 'text' | 'number' | 'date' | 'select',
  options?: string[],
): Promise<ActionResult<CustomFieldRow>> {
  const { orgId, supabase } = await getOrgId();
  if (!orgId) return { success: false, error: 'Organização não encontrada' };

  const trimmed = fieldName.trim();
  if (!trimmed) return { success: false, error: 'Nome do campo é obrigatório' };

  if (fieldType === 'select' && (!options || options.length === 0)) {
    return { success: false, error: 'Campos do tipo select precisam de pelo menos uma opção' };
  }

  const { data, error } = (await customFieldsFrom(supabase)
    .update({
      field_name: trimmed,
      field_type: fieldType,
      options: fieldType === 'select' ? options : null,
    })
    .eq('id', id)
    .eq('org_id', orgId)
    .select()
    .single()) as { data: CustomFieldRow | null; error: unknown };

  if (error || !data) return { success: false, error: 'Erro ao atualizar campo' };
  return { success: true, data };
}

export async function deleteCustomField(id: string): Promise<ActionResult<{ deleted: true }>> {
  const { orgId, supabase } = await getOrgId();
  if (!orgId) return { success: false, error: 'Organização não encontrada' };

  const { error } = await customFieldsFrom(supabase)
    .delete()
    .eq('id', id)
    .eq('org_id', orgId);

  if (error) return { success: false, error: 'Erro ao remover campo' };
  return { success: true, data: { deleted: true } };
}
