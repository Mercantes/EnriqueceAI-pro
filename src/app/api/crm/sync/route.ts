import { NextResponse } from 'next/server';

import { createServerSupabaseClient } from '@/lib/supabase/server';

import type { CrmConnectionRow } from '@/features/integrations/types/crm';
import { CrmSyncService } from '@/features/integrations/services/crm-sync.service';

interface SyncRequestBody {
  connectionId?: string;
}

/**
 * POST /api/crm/sync
 * Triggers CRM sync. Can sync a specific connection or all active connections.
 * Called by:
 * - Manual sync button (with connectionId)
 * - pg_cron every 30 minutes (without connectionId = sync all)
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SyncRequestBody;
    const supabase = await createServerSupabaseClient();

    if (body.connectionId) {
      // Sync specific connection
      const result = await CrmSyncService.syncConnection(body.connectionId);
      return NextResponse.json({
        success: true,
        data: result,
      });
    }

    // Sync all active connections
    const { data: connections } = (await (supabase
      .from('crm_connections') as ReturnType<typeof supabase.from>)
      .select('id')
      .eq('status', 'connected')) as { data: Pick<CrmConnectionRow, 'id'>[] | null };

    const results = [];
    for (const conn of connections ?? []) {
      try {
        const result = await CrmSyncService.syncConnection(conn.id);
        results.push({ connectionId: conn.id, ...result });
      } catch (error) {
        results.push({
          connectionId: conn.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Sync failed',
      },
      { status: 500 },
    );
  }
}
