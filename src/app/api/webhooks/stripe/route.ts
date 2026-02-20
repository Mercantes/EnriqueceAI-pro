import { NextResponse } from 'next/server';
import type Stripe from 'stripe';

import { stripe } from '@/lib/stripe';
import { createServiceRoleClient } from '@/lib/supabase/service';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

/** Extract period dates from a Stripe subscription (v20+: period is on items) */
function getSubscriptionPeriod(sub: Stripe.Subscription) {
  const item = sub.items?.data?.[0];
  if (item) {
    return {
      start: new Date(item.current_period_start * 1000).toISOString(),
      end: new Date(item.current_period_end * 1000).toISOString(),
    };
  }
  // Fallback: use created date + 30 days
  return {
    start: new Date(sub.created * 1000).toISOString(),
    end: new Date((sub.created + 30 * 24 * 60 * 60) * 1000).toISOString(),
  };
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Stripe webhook signature verification failed:', message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const orgId = session.metadata?.org_id;
        const planId = session.metadata?.plan_id;
        const stripeSubscriptionId = session.subscription as string;

        if (orgId && planId && stripeSubscriptionId) {
          // Fetch subscription details from Stripe
          const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
          const period = getSubscriptionPeriod(sub);

          await (supabase
            .from('subscriptions') as ReturnType<typeof supabase.from>)
            .update({
              plan_id: planId,
              status: 'active',
              stripe_subscription_id: stripeSubscriptionId,
              current_period_start: period.start,
              current_period_end: period.end,
            } as Record<string, unknown>)
            .eq('org_id', orgId);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;

        // Find org by stripe_customer_id
        const { data: org } = (await (supabase
          .from('organizations') as ReturnType<typeof supabase.from>)
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single()) as { data: { id: string } | null };

        if (org) {
          const statusMap: Record<string, string> = {
            active: 'active',
            past_due: 'past_due',
            canceled: 'canceled',
            trialing: 'trialing',
            incomplete: 'past_due',
            incomplete_expired: 'canceled',
            unpaid: 'past_due',
            paused: 'canceled',
          };

          const period = getSubscriptionPeriod(sub);

          await (supabase
            .from('subscriptions') as ReturnType<typeof supabase.from>)
            .update({
              status: statusMap[sub.status] ?? 'active',
              current_period_start: period.start,
              current_period_end: period.end,
            } as Record<string, unknown>)
            .eq('org_id', org.id);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;

        const { data: org } = (await (supabase
          .from('organizations') as ReturnType<typeof supabase.from>)
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single()) as { data: { id: string } | null };

        if (org) {
          await (supabase
            .from('subscriptions') as ReturnType<typeof supabase.from>)
            .update({
              status: 'canceled',
              stripe_subscription_id: null,
            } as Record<string, unknown>)
            .eq('org_id', org.id);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        const { data: org } = (await (supabase
          .from('organizations') as ReturnType<typeof supabase.from>)
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single()) as { data: { id: string } | null };

        if (org) {
          // Update subscription status to past_due
          await (supabase
            .from('subscriptions') as ReturnType<typeof supabase.from>)
            .update({ status: 'past_due' } as Record<string, unknown>)
            .eq('org_id', org.id);
        }
        break;
      }
    }
  } catch (err) {
    console.error('Error processing Stripe webhook:', err);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
