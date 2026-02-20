import { NextResponse } from 'next/server';

import { createServiceRoleClient } from '@/lib/supabase/service';

// 1x1 transparent GIF
const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ interactionId: string }> },
) {
  const { interactionId } = await params;

  // Fire-and-forget: don't block the pixel response
  try {
    const supabase = createServiceRoleClient();

    const { data: interaction } = (await (supabase
      .from('interactions') as ReturnType<typeof supabase.from>)
      .select('metadata')
      .eq('id', interactionId)
      .single()) as { data: { metadata: Record<string, unknown> | null } | null };

    if (interaction) {
      const metadata = interaction.metadata ?? {};
      const openCount = (typeof metadata.open_count === 'number' ? metadata.open_count : 0) + 1;

      await (supabase.from('interactions') as ReturnType<typeof supabase.from>)
        .update({ metadata: { ...metadata, open_count: openCount } } as Record<string, unknown>)
        .eq('id', interactionId);
    }
  } catch (err) {
    console.error('[track/open] Error recording open:', err);
  }

  return new NextResponse(TRANSPARENT_GIF, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Content-Length': String(TRANSPARENT_GIF.length),
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    },
  });
}
