import { NextResponse } from 'next/server';

import { createServiceRoleClient } from '@/lib/supabase/service';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ interactionId: string }> },
) {
  const { interactionId } = await params;
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  // Validate URL — only allow http/https to prevent open redirect
  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json({ error: 'Invalid URL protocol' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  // Record click (fire-and-forget — don't block redirect)
  try {
    const supabase = createServiceRoleClient();

    const { data: interaction } = (await (supabase
      .from('interactions') as ReturnType<typeof supabase.from>)
      .select('metadata')
      .eq('id', interactionId)
      .single()) as { data: { metadata: Record<string, unknown> | null } | null };

    if (interaction) {
      const metadata = interaction.metadata ?? {};
      const clicks = Array.isArray(metadata.clicks) ? metadata.clicks : [];
      clicks.push({ url: parsedUrl.href, clicked_at: new Date().toISOString() });

      await (supabase.from('interactions') as ReturnType<typeof supabase.from>)
        .update({ metadata: { ...metadata, clicks } } as Record<string, unknown>)
        .eq('id', interactionId);
    }
  } catch (err) {
    console.error('[track/click] Error recording click:', err);
  }

  return NextResponse.redirect(parsedUrl.href, 302);
}
