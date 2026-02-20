import { NextResponse } from 'next/server';

// Legacy webhook endpoint — redirects to specific provider routes.
// WhatsApp: /api/webhooks/whatsapp
// Stripe: /api/webhooks/stripe

export async function GET() {
  return NextResponse.json({ status: 'ok', message: 'Use provider-specific webhook endpoints' });
}

export async function POST() {
  return NextResponse.json(
    { error: 'Use provider-specific webhook endpoints: /api/webhooks/stripe, /api/webhooks/whatsapp' },
    { status: 400 },
  );
}
