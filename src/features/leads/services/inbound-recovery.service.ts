import { from } from '@/lib/supabase/from';
import { createServiceRoleClient } from '@/lib/supabase/service';

import { logLeadEvent } from '../actions/log-lead-event';
import { createNotification } from '@/features/notifications/services/notification.service';

/**
 * Recuperação automática de leads inbound perdidos.
 *
 * Quando um lead inbound (Blackbox/Leadbroker) é dado como perdido com um
 * motivo "reativável" (Nunca respondeu / Sem interesse / Sem timing), o lead é
 * redistribuído entre os SDRs de outbound configurados e inscrito na cadência
 * Recovery com início agendado (enrollment pausado + scheduled_start_at).
 * O motor de cadência (execute-cadence.ts) ativa o enrollment na data e volta o
 * lead de 'unqualified' para 'new' sozinho — nenhuma infra nova é necessária.
 *
 * Liga/desliga sem deploy via app_flags (key abaixo), mesmo padrão do webhook
 * de reunião. A regra em si é por org (RULES).
 */

export const INBOUND_RECOVERY_FLAG_KEY = 'inbound_recovery_enabled';

/** Origens de lead consideradas inbound (mesma regra de get-response-time.ts) */
const INBOUND_LEAD_SOURCES = ['Blackbox', 'Leadbroker'];

export interface InboundRecoveryRule {
  /** Cadência de destino (precisa estar active) */
  cadenceId: string;
  /** SDRs que recebem os leads, em ordem de desempate */
  sdrs: Array<{ id: string; name: string }>;
  /** Dias até o enrollment agendado começar */
  delayDays: number;
  /** Motivos de perda que disparam a regra (comparação case-insensitive) */
  reasonNames: string[];
}

/** Regras por org. V4 Amaral: perdidos do inbound do Ismael → Recovery. */
const RULES: Record<string, InboundRecoveryRule> = {
  'c2727473-1df8-4faa-9264-a9fc1759fe3b': {
    cadenceId: '15a05299-1627-40d1-be81-80150a4f1308', // Recovery
    sdrs: [
      { id: 'edd824ed-b823-4210-97ca-9063d8b4b028', name: 'Matheus Martins' },
      { id: 'e2f24cd5-ce36-495b-840f-88900bf989e5', name: 'Guilherme Marques' },
      { id: '5769812d-c562-437f-8259-987c2c2dbecd', name: 'Giovanni Olivieri' },
      { id: '3e0deabd-e491-48a1-8c9b-92423b0f55b7', name: 'João Fogaça' },
    ],
    delayDays: 10,
    reasonNames: ['Nunca respondeu', 'Sem interesse', 'Sem timing'],
  },
};

export function isRecoverableLossReason(reasonName: string | null | undefined, rule: InboundRecoveryRule): boolean {
  if (!reasonName) return false;
  const normalized = reasonName.trim().toLowerCase();
  return rule.reasonNames.some((r) => r.toLowerCase() === normalized);
}

export function isInboundLeadSource(leadSource: string | null | undefined): boolean {
  return !!leadSource && INBOUND_LEAD_SOURCES.includes(leadSource);
}

/**
 * Escolhe o SDR com menor carga atual; empate resolve pela ordem da lista.
 * `counts` é mutado pelo chamador conforme distribui (round-robin num lote).
 */
export function pickLeastLoadedSdr(
  sdrIds: string[],
  counts: Record<string, number>,
): string | null {
  let picked: string | null = null;
  for (const id of sdrIds) {
    if (picked === null || (counts[id] ?? 0) < (counts[picked] ?? 0)) {
      picked = id;
    }
  }
  return picked;
}

async function isFlagEnabled(serviceClient: ReturnType<typeof createServiceRoleClient>): Promise<boolean> {
  try {
    const { data } = (await from(serviceClient, 'app_flags' as never)
      .select('enabled')
      .eq('key', INBOUND_RECOVERY_FLAG_KEY)
      .limit(1)) as { data: Array<{ enabled: boolean }> | null };
    return data?.[0]?.enabled === true;
  } catch {
    return false;
  }
}

/**
 * Redistribui e agenda Recovery para os leads inbound recém-perdidos que se
 * enquadram na regra da org. Nunca lança — falha aqui não pode quebrar o
 * "dar perdido"; erros vão para o console.
 */
export async function scheduleInboundRecovery(params: {
  orgId: string;
  leadIds: string[];
  lossReasonName: string | null | undefined;
  /** Quem deu o perdido — vira enrolled_by do novo enrollment */
  userId: string;
}): Promise<{ scheduled: number }> {
  const { orgId, leadIds, lossReasonName, userId } = params;
  const none = { scheduled: 0 };
  try {
    const rule = RULES[orgId];
    if (!rule || leadIds.length === 0) return none;
    if (!isRecoverableLossReason(lossReasonName, rule)) return none;

    const serviceClient = createServiceRoleClient();
    if (!(await isFlagEnabled(serviceClient))) return none;

    // Leads inbound entre os perdidos (org-scoped)
    const { data: leads } = (await from(serviceClient, 'leads')
      .select('id, lead_source, nome_fantasia, razao_social')
      .eq('org_id', orgId)
      .in('id', leadIds)
      .in('lead_source', INBOUND_LEAD_SOURCES)) as {
      data: Array<{ id: string; lead_source: string; nome_fantasia: string | null; razao_social: string | null }> | null;
    };
    if (!leads || leads.length === 0) return none;

    // Cadência de destino precisa existir e estar ativa
    const { data: cadence } = (await from(serviceClient, 'cadences')
      .select('id, name, status')
      .eq('id', rule.cadenceId)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .single()) as { data: { id: string; name: string; status: string } | null };
    if (!cadence || cadence.status !== 'active') {
      console.error(`[inbound-recovery] cadência ${rule.cadenceId} indisponível (status=${cadence?.status ?? 'não encontrada'})`);
      return none;
    }

    // Só SDRs ainda ativos na org recebem leads
    const { data: members } = (await from(serviceClient, 'organization_members')
      .select('user_id')
      .eq('org_id', orgId)
      .eq('status', 'active')
      .in('user_id', rule.sdrs.map((s) => s.id))) as { data: Array<{ user_id: string }> | null };
    const activeSdrIds = rule.sdrs.map((s) => s.id).filter((id) => (members ?? []).some((m) => m.user_id === id));
    if (activeSdrIds.length === 0) {
      console.error('[inbound-recovery] nenhum SDR configurado está ativo na org');
      return none;
    }

    // Carga atual: enrollments abertos na cadência de destino por SDR dono do lead
    const { data: openEnrollments } = (await from(serviceClient, 'cadence_enrollments')
      .select('id, lead:leads!inner(assigned_to)')
      .eq('cadence_id', rule.cadenceId)
      .in('status', ['active', 'paused'])
      .in('lead.assigned_to', activeSdrIds)) as {
      data: Array<{ id: string; lead: { assigned_to: string | null } }> | null;
    };
    const counts: Record<string, number> = {};
    for (const id of activeSdrIds) counts[id] = 0;
    for (const e of openEnrollments ?? []) {
      const owner = e.lead?.assigned_to;
      if (owner && owner in counts) counts[owner] = (counts[owner] ?? 0) + 1;
    }

    const startAt = new Date(Date.now() + rule.delayDays * 24 * 60 * 60 * 1000).toISOString();
    const startLabel = new Date(startAt).toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric',
    });

    let scheduled = 0;
    for (const lead of leads) {
      const sdrId = pickLeastLoadedSdr(activeSdrIds, counts);
      if (!sdrId) break;
      counts[sdrId] = (counts[sdrId] ?? 0) + 1;
      const sdrName = rule.sdrs.find((s) => s.id === sdrId)?.name ?? 'SDR';

      const { error: assignError } = await from(serviceClient, 'leads')
        .update({ assigned_to: sdrId } as Record<string, unknown>)
        .eq('id', lead.id)
        .eq('org_id', orgId);
      if (assignError) {
        console.error(`[inbound-recovery] lead=${lead.id} falha ao reatribuir:`, assignError.message);
        continue;
      }

      // Fecha um eventual enrollment aberto na própria Recovery antes de inserir
      // (mesma proteção de scheduleNewProspection contra enrollment duplicado)
      await from(serviceClient, 'cadence_enrollments')
        .update({ status: 'completed', completed_at: new Date().toISOString() } as Record<string, unknown>)
        .eq('cadence_id', rule.cadenceId)
        .eq('lead_id', lead.id)
        .in('status', ['active', 'paused']);

      const { data: enrollment, error: insertError } = (await from(serviceClient, 'cadence_enrollments')
        .insert({
          cadence_id: rule.cadenceId,
          lead_id: lead.id,
          org_id: orgId,
          current_step: 1,
          status: 'paused',
          enrolled_by: userId,
          scheduled_start_at: startAt,
        } as Record<string, unknown>)
        .select('id')
        .single()) as { data: { id: string } | null; error: { message: string } | null };
      if (insertError || !enrollment) {
        console.error(`[inbound-recovery] lead=${lead.id} falha ao agendar enrollment:`, insertError?.message);
        continue;
      }

      // next_step_due = data agendada (mesmo passo extra de scheduleNewProspection)
      await from(serviceClient, 'cadence_enrollments')
        .update({ next_step_due: startAt } as Record<string, unknown>)
        .eq('id', enrollment.id);

      await logLeadEvent(serviceClient, {
        orgId,
        leadId: lead.id,
        userId: null,
        event: 'inbound_recovery_scheduled',
        message: `Perda reativável de lead inbound — redistribuído para ${sdrName} e agendado na cadência ${cadence.name} para ${startLabel}`,
        metadata: {
          cadence_id: rule.cadenceId,
          assigned_to: sdrId,
          scheduled_start_at: startAt,
          loss_reason_name: lossReasonName,
        },
      });

      const displayName = lead.nome_fantasia ?? lead.razao_social ?? 'Lead';
      createNotification({
        org_id: orgId,
        user_id: sdrId,
        type: 'lead_inbound',
        title: `Lead inbound recebido para Recovery: ${displayName}`,
        body: `Perdido por "${lossReasonName}" — entra na cadência ${cadence.name} em ${startLabel}`,
        resource_type: 'lead',
        resource_id: lead.id,
      }).catch((err) => console.error('[inbound-recovery] notificação falhou:', err));

      scheduled++;
    }

    if (scheduled > 0) {
      console.warn(`[inbound-recovery] ${scheduled} lead(s) redistribuído(s) e agendado(s) na Recovery para ${startLabel}`);
    }
    return { scheduled };
  } catch (err) {
    console.error('[inbound-recovery] falha inesperada (perda do lead não foi afetada):', err);
    return none;
  }
}
