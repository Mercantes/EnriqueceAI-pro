import { NextResponse } from 'next/server';

import { createServiceRoleClient } from '@/lib/supabase/service';

interface WhatsAppStatusUpdate {
  object: string;
  entry?: {
    changes?: {
      value?: {
        statuses?: {
          id: string;
          status: 'sent' | 'delivered' | 'read' | 'failed';
          timestamp: string;
          errors?: { code: number; title: string }[];
        }[];
      };
    }[];
  }[];
}

export async function GET(request: Request) {
  // WhatsApp webhook verification
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === verifyToken && challenge) {
    return new Response(challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

export async function POST(request: Request) {
  const body = (await request.json()) as WhatsAppStatusUpdate;

  // Handle WhatsApp status updates
  if (body.object === 'whatsapp_business_account') {
    const supabase = createServiceRoleClient();

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        for (const status of change.value?.statuses ?? []) {
          // Map WhatsApp status to our interaction type
          const typeMap: Record<string, string> = {
            sent: 'sent',
            delivered: 'delivered',
            read: 'opened',
            failed: 'failed',
          };

          const interactionType = typeMap[status.status];
          if (!interactionType) continue;

          // Update interaction by external_id
          await (supabase
            .from('interactions') as ReturnType<typeof supabase.from>)
            .update({
              type: interactionType,
              metadata: status.errors ? { errors: status.errors } : null,
            } as Record<string, unknown>)
            .eq('external_id', status.id);
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
