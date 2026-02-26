'use server';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { ActionResult } from '@/lib/actions/action-result';
import { createServiceRoleClient } from '@/lib/supabase/service';

import {
  type GmailConnection,
  refreshAccessToken,
} from '@/features/integrations/services/email.service';

const REPLY_CHECK_DAYS = 30;
const BATCH_SIZE = 100;

interface SentInteraction {
  id: string;
  lead_id: string;
  cadence_id: string;
  external_id: string;
  metadata: Record<string, unknown> | null;
}

interface CadenceCreator {
  id: string;
  created_by: string;
}

/**
 * Checks Gmail threads for replies to sent email interactions.
 * Runs via cron — uses service role (no cookies).
 */
export async function checkEmailReplies(): Promise<ActionResult<{ found: number }>> {
  const supabase = createServiceRoleClient();
  let found = 0;

  // 1. Fetch sent email interactions from the last N days that have an external_id
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - REPLY_CHECK_DAYS);

  const { data: sentInteractions, error: fetchError } = (await (supabase
    .from('interactions') as ReturnType<typeof supabase.from>)
    .select('id, lead_id, cadence_id, external_id, metadata')
    .eq('type', 'sent')
    .eq('channel', 'email')
    .not('external_id', 'is', null)
    .gte('created_at', cutoffDate.toISOString())
    .limit(BATCH_SIZE)) as { data: SentInteraction[] | null; error: { message: string } | null };

  if (fetchError || !sentInteractions?.length) {
    if (fetchError) {
      console.error('[reply-check] Failed to fetch interactions:', fetchError.message);
      return { success: false, error: fetchError.message };
    }
    return { success: true, data: { found: 0 } };
  }

  // 2. Filter out interactions that already have a 'replied' counterpart
  const cadenceLeadPairs = sentInteractions.map((i) => `${i.cadence_id}:${i.lead_id}`);
  const uniquePairs = [...new Set(cadenceLeadPairs)];

  const repliedMap = new Set<string>();
  // Check in batches of unique cadence+lead pairs
  for (const pair of uniquePairs) {
    const [cadenceId, leadId] = pair.split(':');
    const { data: existing } = (await (supabase
      .from('interactions') as ReturnType<typeof supabase.from>)
      .select('id')
      .eq('cadence_id', cadenceId!)
      .eq('lead_id', leadId!)
      .eq('type', 'replied')
      .limit(1)
      .maybeSingle()) as { data: { id: string } | null };

    if (existing) {
      repliedMap.add(pair);
    }
  }

  const toCheck = sentInteractions.filter(
    (i) => !repliedMap.has(`${i.cadence_id}:${i.lead_id}`),
  );

  if (!toCheck.length) {
    return { success: true, data: { found: 0 } };
  }

  // 3. Group by cadence → get created_by (the Gmail user)
  const cadenceIds = [...new Set(toCheck.map((i) => i.cadence_id))];
  const { data: cadences } = (await (supabase
    .from('cadences') as ReturnType<typeof supabase.from>)
    .select('id, created_by')
    .in('id', cadenceIds)) as { data: CadenceCreator[] | null };

  if (!cadences?.length) {
    return { success: true, data: { found: 0 } };
  }

  const cadenceCreatorMap = new Map<string, string>();
  for (const c of cadences) {
    if (c.created_by) {
      cadenceCreatorMap.set(c.id, c.created_by);
    }
  }

  // 4. Group interactions by user_id → process per user's Gmail
  const byUser = new Map<string, SentInteraction[]>();
  for (const interaction of toCheck) {
    const userId = cadenceCreatorMap.get(interaction.cadence_id);
    if (!userId) continue;
    const list = byUser.get(userId) ?? [];
    list.push(interaction);
    byUser.set(userId, list);
  }

  // 5. For each user, get Gmail connection and check threads
  for (const [userId, interactions] of byUser) {
    const accessToken = await getValidAccessToken(supabase, userId);
    if (!accessToken) {
      console.error(`[reply-check] No valid Gmail token for user=${userId}`);
      continue;
    }

    for (const interaction of interactions) {
      const threadId = await getThreadId(supabase, interaction, accessToken);
      if (!threadId) continue;

      const hasReply = await checkThreadForReply(threadId, accessToken);
      if (!hasReply) continue;

      // Reply found — create replied interaction + update enrollment
      await recordReply(supabase, interaction);
      found++;
      console.warn(`[reply-check] Reply found: interaction=${interaction.id} lead=${interaction.lead_id} cadence=${interaction.cadence_id}`);
    }
  }

  console.warn(`[reply-check] Complete: checked=${toCheck.length} found=${found}`);
  return { success: true, data: { found } };
}

/** Get a valid access token for a user's Gmail connection, refreshing if needed */
async function getValidAccessToken(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  // Get the user's org first
  const { data: member } = (await (supabase
    .from('organization_members') as ReturnType<typeof supabase.from>)
    .select('org_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()) as { data: { org_id: string } | null };

  if (!member) return null;

  const { data: connection } = (await (supabase
    .from('gmail_connections') as ReturnType<typeof supabase.from>)
    .select('*')
    .eq('org_id', member.org_id)
    .eq('user_id', userId)
    .in('status', ['connected', 'error'])
    .maybeSingle()) as { data: GmailConnection | null };

  if (!connection) return null;

  // Check if token is expired
  if (connection.status === 'error' || new Date(connection.token_expires_at) < new Date()) {
    const refreshResult = await refreshAccessToken(connection, supabase);
    if ('error' in refreshResult) return null;
    return refreshResult.accessToken;
  }

  return connection.access_token_encrypted;
}

/** Get the threadId for an interaction, from metadata cache or Gmail API */
async function getThreadId(
  supabase: SupabaseClient,
  interaction: SentInteraction,
  accessToken: string,
): Promise<string | null> {
  // Check cached threadId in metadata
  const cachedThreadId = interaction.metadata?.thread_id as string | undefined;
  if (cachedThreadId) return cachedThreadId;

  // Fetch from Gmail API
  try {
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${interaction.external_id}?fields=threadId`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!response.ok) return null;

    const data = (await response.json()) as { threadId?: string };
    const threadId = data.threadId ?? null;

    // Cache the threadId for next time
    if (threadId) {
      const existingMeta = interaction.metadata ?? {};
      await (supabase.from('interactions') as ReturnType<typeof supabase.from>)
        .update({
          metadata: { ...existingMeta, thread_id: threadId },
        } as Record<string, unknown>)
        .eq('id', interaction.id);
    }

    return threadId;
  } catch {
    return null;
  }
}

/** Check if a Gmail thread has more than 1 message (indicating a reply) */
async function checkThreadForReply(
  threadId: string,
  accessToken: string,
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?fields=messages(id)`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!response.ok) return false;

    const data = (await response.json()) as { messages?: { id: string }[] };
    return (data.messages?.length ?? 0) > 1;
  } catch {
    return false;
  }
}

/** Record a reply: create replied interaction + update enrollment status */
async function recordReply(
  supabase: SupabaseClient,
  sentInteraction: SentInteraction,
): Promise<void> {
  // Get org_id from the lead
  const { data: lead } = (await (supabase
    .from('leads') as ReturnType<typeof supabase.from>)
    .select('org_id')
    .eq('id', sentInteraction.lead_id)
    .single()) as { data: { org_id: string } | null };

  if (!lead) return;

  // Create replied interaction
  await (supabase
    .from('interactions') as ReturnType<typeof supabase.from>)
    .insert({
      org_id: lead.org_id,
      lead_id: sentInteraction.lead_id,
      cadence_id: sentInteraction.cadence_id,
      step_id: null,
      channel: 'email',
      type: 'replied',
      message_content: null,
      metadata: { detected_by: 'gmail_thread_poll', sent_interaction_id: sentInteraction.id },
    } as Record<string, unknown>);

  // Update active enrollment to replied
  await (supabase
    .from('cadence_enrollments') as ReturnType<typeof supabase.from>)
    .update({ status: 'replied' } as Record<string, unknown>)
    .eq('lead_id', sentInteraction.lead_id)
    .eq('cadence_id', sentInteraction.cadence_id)
    .eq('status', 'active');
}
