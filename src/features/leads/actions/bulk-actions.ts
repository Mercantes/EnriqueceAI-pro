'use server';

import { revalidatePath } from 'next/cache';

import type { ActionResult } from '@/lib/actions/action-result';
import { requireAuth } from '@/lib/auth/require-auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

import { CnpjWsProvider } from '../services/enrichment-provider';
import { enrichLead } from '../services/enrichment.service';

async function getOrgId(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, userId: string) {
  const { data: member } = (await supabase
    .from('organization_members')
    .select('org_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single()) as { data: { org_id: string } | null };
  return member?.org_id ?? null;
}

export async function bulkArchiveLeads(
  leadIds: string[],
): Promise<ActionResult<{ count: number }>> {
  const user = await requireAuth();
  const supabase = await createServerSupabaseClient();

  const orgId = await getOrgId(supabase, user.id);
  if (!orgId) {
    return { success: false, error: 'Organização não encontrada' };
  }

  if (leadIds.length === 0) {
    return { success: false, error: 'Nenhum lead selecionado' };
  }

  const { error } = await (supabase.from('leads') as ReturnType<typeof supabase.from>)
    .update({ status: 'archived' } as Record<string, unknown>)
    .eq('org_id', orgId)
    .in('id', leadIds);

  if (error) {
    return { success: false, error: 'Erro ao arquivar leads' };
  }

  revalidatePath('/leads');

  return { success: true, data: { count: leadIds.length } };
}

export async function bulkEnrichLeads(
  leadIds: string[],
): Promise<ActionResult<{ successCount: number; failCount: number }>> {
  const user = await requireAuth();
  const supabase = await createServerSupabaseClient();

  const orgId = await getOrgId(supabase, user.id);
  if (!orgId) {
    return { success: false, error: 'Organização não encontrada' };
  }

  if (leadIds.length === 0) {
    return { success: false, error: 'Nenhum lead selecionado' };
  }

  const provider = new CnpjWsProvider();
  let successCount = 0;
  let failCount = 0;

  for (const leadId of leadIds) {
    // Get lead CNPJ (verify ownership)
    const { data: lead } = (await supabase
      .from('leads')
      .select('cnpj, org_id')
      .eq('id', leadId)
      .single()) as { data: { cnpj: string; org_id: string } | null };

    if (!lead || lead.org_id !== orgId) {
      failCount++;
      continue;
    }

    const result = await enrichLead({
      leadId,
      cnpj: lead.cnpj,
      provider,
      supabase,
    });

    if (result.success) {
      successCount++;
    } else {
      failCount++;
    }

    // Rate limiting: 20s between requests for CNPJ.ws (3 req/min)
    if (leadIds.indexOf(leadId) < leadIds.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 20000));
    }
  }

  revalidatePath('/leads');

  return { success: true, data: { successCount, failCount } };
}

export async function exportLeadsCsv(
  leadIds: string[],
): Promise<ActionResult<{ csv: string; filename: string }>> {
  const user = await requireAuth();
  const supabase = await createServerSupabaseClient();

  const orgId = await getOrgId(supabase, user.id);
  if (!orgId) {
    return { success: false, error: 'Organização não encontrada' };
  }

  if (leadIds.length === 0) {
    return { success: false, error: 'Nenhum lead selecionado' };
  }

  const { data, error } = (await (supabase.from('leads') as ReturnType<typeof supabase.from>)
    .select('cnpj, razao_social, nome_fantasia, porte, cnae, email, telefone, status, enrichment_status, endereco, created_at')
    .eq('org_id', orgId)
    .in('id', leadIds)) as {
    data: Record<string, unknown>[] | null;
    error: { message: string } | null;
  };

  if (error || !data) {
    return { success: false, error: 'Erro ao exportar leads' };
  }

  const headers = ['CNPJ', 'Razão Social', 'Nome Fantasia', 'Porte', 'CNAE', 'Email', 'Telefone', 'UF', 'Cidade', 'Status', 'Enriquecimento', 'Criado em'];

  const rows = data.map((lead) => {
    const endereco = lead.endereco as { uf?: string; cidade?: string } | null;
    return [
      lead.cnpj as string,
      (lead.razao_social as string) ?? '',
      (lead.nome_fantasia as string) ?? '',
      (lead.porte as string) ?? '',
      (lead.cnae as string) ?? '',
      (lead.email as string) ?? '',
      (lead.telefone as string) ?? '',
      endereco?.uf ?? '',
      endereco?.cidade ?? '',
      lead.status as string,
      lead.enrichment_status as string,
      lead.created_at as string,
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
  });

  const csv = [headers.join(','), ...rows].join('\n');
  const filename = `leads-export-${new Date().toISOString().slice(0, 10)}.csv`;

  return { success: true, data: { csv, filename } };
}
