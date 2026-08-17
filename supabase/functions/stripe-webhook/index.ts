/**
 * Edge Function: stripe-webhook
 *
 * POST /stripe-webhook   Headers: stripe-signature
 *
 * Endpoint unico dos webhooks da Stripe. Roda com verify_jwt = false (a Stripe
 * nao manda token de login), por isso a validacao da assinatura abaixo NAO e
 * opcional — ela e a unica autenticacao desta function.
 *
 * Contratos de resposta:
 *   400 -> assinatura invalida ou ausente (unico caso)
 *   500 -> erro de banco (a Stripe reenvia depois)
 *   200 -> todo o resto, inclusive evento ignorado, duplicado ou org nao achada
 *
 * Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
 *          (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sao injetados pelo runtime)
 */
// Mesma major do app (package.json: stripe@^20.3.1), para que os formatos de
// payload aqui e no src/ nao divirjam.
import Stripe from 'npm:stripe@20.3.1';
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { supabaseAdmin } from '../_shared/supabase-admin.ts';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET');

/**
 * Duas adaptacoes obrigatorias para o Deno:
 *  - `createFetchHttpClient`: o SDK assume o `http` do Node por padrao;
 *  - `createSubtleCryptoProvider` + `constructEventAsync`: o Web Crypto do Deno
 *    e assincrono, entao o `constructEvent` sincrono simplesmente nao funciona.
 * apiVersion nao e fixada de proposito — segue o default do SDK, igual ao app.
 */
/**
 * A chave so e necessaria para as chamadas de LEITURA (subscriptions.retrieve,
 * customers.retrieve). A validacao de assinatura usa apenas o webhook secret e
 * o Web Crypto — nao toca na API key.
 *
 * O SDK v20 lanca `Neither apiKey nor config.authenticator provided` se receber
 * string vazia, e isso mataria o modulo inteiro no boot. Com o placeholder a
 * function sobe mesmo sem a chave: assinatura continua sendo validada e o
 * status/periodo continuam sendo gravados; so o enriquecimento e pulado (as
 * chamadas a Stripe sao guardadas por `if (!STRIPE_SECRET_KEY) return null`).
 * Foi exatamente esse o modo de falha do incidente de 13/ago, com a chave
 * expirada derrubando o processamento inteiro.
 */
const stripe = new Stripe(STRIPE_SECRET_KEY || 'sk_placeholder_not_configured', {
  httpClient: Stripe.createFetchHttpClient(),
});
if (!STRIPE_SECRET_KEY) {
  console.error('[stripe-webhook] STRIPE_SECRET_KEY ausente — chamadas de leitura desativadas');
}
const cryptoProvider = Stripe.createSubtleCryptoProvider();

/** Plano usado apenas quando precisamos INSERIR uma assinatura e nao ha plano resolvido. */
const STARTER_PLAN_ID = '50d531b6-89cf-43b0-ab3a-d5f16229fde9';

const HANDLED_EVENTS = new Set([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
]);

/**
 * O enum subscription_status so aceita 4 valores. Status desconhecido cai em
 * 'past_due' (fail-closed) — nunca liberar acesso por omissao.
 */
const STATUS_MAP: Record<string, string> = {
  active: 'active',
  trialing: 'trialing',
  past_due: 'past_due',
  unpaid: 'past_due',
  incomplete: 'past_due',
  canceled: 'canceled',
  incomplete_expired: 'canceled',
};

function mapStripeStatus(status: string | null | undefined): string {
  if (!status) return 'past_due';
  return STATUS_MAP[status] ?? 'past_due';
}

/** Erro de banco — o unico que vira 500 e faz a Stripe reenviar. */
class DbError extends Error {
  constructor(context: string, cause: unknown) {
    super(`${context}: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = 'DbError';
  }
}

function log(level: 'info' | 'error', message: string, meta: Record<string, unknown> = {}) {
  const line = `[stripe-webhook] ${message} ${JSON.stringify(meta)}`;
  if (level === 'error') console.error(line);
  else console.warn(line);
}

// ---------------------------------------------------------------------------
// Extracao de dados do evento
// ---------------------------------------------------------------------------

function toId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && 'id' in (value as Record<string, unknown>)) {
    const id = (value as { id?: unknown }).id;
    return typeof id === 'string' ? id : null;
  }
  return null;
}

function toIso(seconds: unknown): string | null {
  return typeof seconds === 'number' && Number.isFinite(seconds)
    ? new Date(seconds * 1000).toISOString()
    : null;
}

/**
 * A Stripe v20+ moveu current_period_start/end da subscription para dentro do
 * item. Tentamos o item, depois a raiz (contas em API version antiga) e, em
 * ultimo caso, created + 30 dias.
 */
function getPeriod(sub: Record<string, any> | null): { start: string; end: string } | null {
  if (!sub) return null;

  // Com varios items os periodos podem divergir; o envelope [min, max] e a
  // semantica certa para "a org esta paga ate quando".
  const items: Array<Record<string, any>> = sub.items?.data ?? [];
  const itemStarts = items
    .map((i) => i?.current_period_start)
    .filter((n): n is number => typeof n === 'number');
  const itemEnds = items
    .map((i) => i?.current_period_end)
    .filter((n): n is number => typeof n === 'number');

  const start =
    (itemStarts.length ? toIso(Math.min(...itemStarts)) : null) ??
    toIso(sub.current_period_start);
  const end =
    (itemEnds.length ? toIso(Math.max(...itemEnds)) : null) ?? toIso(sub.current_period_end);
  if (start && end) return { start, end };

  const created = toIso(sub.created);
  if (created) {
    return {
      start: created,
      end: new Date(new Date(created).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }
  return null;
}

function getPriceFromSubscription(sub: Record<string, any> | null) {
  const price = sub?.items?.data?.[0]?.price;
  return {
    priceId: toId(price),
    unitAmount: typeof price?.unit_amount === 'number' ? price.unit_amount : null,
  };
}

/**
 * O id da subscription numa invoice mudou de lugar entre versoes da API:
 * `invoice.subscription` (antigo) vs `invoice.parent.subscription_details.subscription`
 * (novo) vs dentro da linha. Tentamos os tres.
 */
function getSubscriptionIdFromInvoice(invoice: Record<string, any>): string | null {
  return (
    toId(invoice.subscription) ??
    toId(invoice.parent?.subscription_details?.subscription) ??
    toId(invoice.lines?.data?.[0]?.parent?.subscription_item_details?.subscription) ??
    null
  );
}

/** Nunca lanca: se a chave da Stripe estiver expirada, seguimos com o payload do evento. */
async function safeRetrieveSubscription(subscriptionId: string | null) {
  if (!subscriptionId || !STRIPE_SECRET_KEY) return null;
  try {
    return (await stripe.subscriptions.retrieve(subscriptionId)) as unknown as Record<string, any>;
  } catch (err) {
    log('error', 'Falha ao buscar subscription na Stripe', {
      subscription_id: subscriptionId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Resolucao da organizacao: metadata -> stripe_customer_id -> e-mail
// ---------------------------------------------------------------------------

async function findOrgByCustomerId(customerId: string | null): Promise<string | null> {
  if (!customerId) return null;
  const { data, error } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();
  if (error) throw new DbError('select organizations by stripe_customer_id', error);
  return data?.id ?? null;
}

async function findOrgByCustomerEmail(customerId: string | null): Promise<string | null> {
  if (!customerId || !STRIPE_SECRET_KEY) return null;

  let email: string | null = null;
  try {
    const customer = (await stripe.customers.retrieve(customerId)) as Record<string, any>;
    if (!customer?.deleted && typeof customer?.email === 'string') email = customer.email;
  } catch (err) {
    log('error', 'Falha ao buscar customer na Stripe', {
      customer_id: customerId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
  if (!email) return null;

  const { data: userId, error: rpcError } = await supabaseAdmin.rpc('find_user_id_by_email', {
    p_email: email,
  });
  if (rpcError) throw new DbError('rpc find_user_id_by_email', rpcError);
  if (!userId) return null;

  // Dono da org primeiro; depois qualquer org onde ele seja membro ativo.
  const { data: owned, error: ownedError } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .eq('owner_id', userId)
    .maybeSingle();
  if (ownedError) throw new DbError('select organizations by owner_id', ownedError);
  if (owned?.id) return owned.id;

  const { data: membership, error: memberError } = await supabaseAdmin
    .from('organization_members')
    .select('org_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();
  if (memberError) throw new DbError('select organization_members by user_id', memberError);
  return membership?.org_id ?? null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * metadata e texto livre controlado por quem cria a sessao/Payment Link — nunca
 * confiar direto. Sem o teste de UUID, um valor invalido vira erro de cast no
 * Postgres; sem o SELECT, um UUID inexistente estoura a FK. Nos dois casos o
 * resultado seria 500 e a Stripe retentando para sempre.
 */
async function findOrgByMetadata(metadataOrgId: string | null): Promise<string | null> {
  if (!metadataOrgId || !UUID_RE.test(metadataOrgId)) return null;
  const { data, error } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .eq('id', metadataOrgId)
    .maybeSingle();
  if (error) throw new DbError('select organizations by metadata org_id', error);
  if (!data) log('error', 'metadata.org_id nao existe em organizations', { org_id: metadataOrgId });
  return data?.id ?? null;
}

async function resolveOrgId(
  metadataOrgId: string | null,
  customerId: string | null,
): Promise<{ orgId: string | null; via: string | null }> {
  const byMetadata = await findOrgByMetadata(metadataOrgId);
  if (byMetadata) return { orgId: byMetadata, via: 'metadata' };

  const byCustomer = await findOrgByCustomerId(customerId);
  if (byCustomer) return { orgId: byCustomer, via: 'stripe_customer_id' };

  const byEmail = await findOrgByCustomerEmail(customerId);
  if (byEmail) return { orgId: byEmail, via: 'customer_email' };

  return { orgId: null, via: null };
}

// ---------------------------------------------------------------------------
// Resolucao do plano: stripe_price_id -> price_cents -> preserva o atual
// ---------------------------------------------------------------------------

async function resolvePlanId(
  metadataPlanId: string | null,
  priceId: string | null,
  unitAmount: number | null,
): Promise<{ planId: string | null; via: string | null }> {
  // O checkout do app manda plan_id no metadata e usa price ad-hoc (price_data
  // inline), que nunca casaria por stripe_price_id — entao este e o sinal mais
  // confiavel quando existe. Validamos que o plano existe antes de gravar
  // (plan_id e FK NOT NULL com ON DELETE RESTRICT).
  if (metadataPlanId && UUID_RE.test(metadataPlanId)) {
    const { data, error } = await supabaseAdmin
      .from('plans')
      .select('id')
      .eq('id', metadataPlanId)
      .maybeSingle();
    if (error) throw new DbError('select plans by metadata plan_id', error);
    if (data?.id) return { planId: data.id, via: 'metadata' };
    log('error', 'metadata.plan_id nao existe em plans', { plan_id: metadataPlanId });
  }

  if (priceId) {
    const { data, error } = await supabaseAdmin
      .from('plans')
      .select('id')
      .eq('stripe_price_id', priceId)
      .maybeSingle();
    if (error) throw new DbError('select plans by stripe_price_id', error);
    if (data?.id) return { planId: data.id, via: 'stripe_price_id' };
  }

  if (typeof unitAmount === 'number') {
    const { data, error } = await supabaseAdmin
      .from('plans')
      .select('id')
      .eq('price_cents', unitAmount)
      .eq('active', true)
      .limit(1) // dois planos podem compartilhar preco; maybeSingle() sozinho estouraria
      .maybeSingle();
    if (error) throw new DbError('select plans by price_cents', error);
    if (data?.id) return { planId: data.id, via: 'price_cents' };
  }

  // Nao resolvido: quem chama preserva o plan_id que ja esta gravado.
  return { planId: null, via: null };
}

// ---------------------------------------------------------------------------
// Gravacao
// ---------------------------------------------------------------------------

/** Grava o customer na org so quando ainda estiver vazio — nunca sobrescreve. */
async function linkCustomerToOrg(orgId: string, customerId: string | null) {
  if (!customerId) return;
  const { error } = await supabaseAdmin
    .from('organizations')
    .update({ stripe_customer_id: customerId })
    .eq('id', orgId)
    .is('stripe_customer_id', null);

  if (error) {
    // stripe_customer_id e UNIQUE: se o customer ja estiver em OUTRA org, isto
    // e um problema de dados que retentar nao resolve. Loga e segue — a
    // assinatura ainda deve ser gravada.
    if (error.code === '23505') {
      log('error', 'stripe_customer_id ja pertence a outra org', {
        org_id: orgId,
        customer_id: customerId,
      });
      return;
    }
    throw new DbError('update organizations.stripe_customer_id', error);
  }
}

async function findSubscriptionRow(subscriptionId: string | null, orgId: string) {
  const columns = 'id, org_id, plan_id, status, stripe_subscription_id';

  if (subscriptionId) {
    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .select(columns)
      .eq('stripe_subscription_id', subscriptionId)
      .maybeSingle();
    if (error) throw new DbError('select subscriptions by stripe_subscription_id', error);
    if (data) return data;
  }

  // Cobre a linha criada por handle_new_user() (trial, ainda sem subscription na Stripe).
  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .select(columns)
    .eq('org_id', orgId)
    .maybeSingle();
  if (error) throw new DbError('select subscriptions by org_id', error);
  return data ?? null;
}

type WriteInput = {
  orgId: string;
  subscriptionId: string | null;
  status: string;
  planId: string | null;
  period: { start: string; end: string } | null;
  /** subscription.deleted: solta o id para nao travar uma reassinatura futura. */
  clearSubscriptionId?: boolean;
};

async function writeSubscription(input: WriteInput): Promise<Record<string, unknown>> {
  const { orgId, subscriptionId, status, planId, period, clearSubscriptionId } = input;
  const existing = await findSubscriptionRow(subscriptionId, orgId);

  // Fora de ordem: evento de uma assinatura antiga nao pode sobrescrever a atual.
  // Se a linha ja foi cancelada, deixamos passar (e uma reassinatura legitima).
  if (
    existing &&
    subscriptionId &&
    existing.stripe_subscription_id &&
    existing.stripe_subscription_id !== subscriptionId &&
    existing.status !== 'canceled'
  ) {
    return {
      result: 'stale_event',
      warning:
        `Evento da subscription ${subscriptionId}, mas a org ${orgId} esta em ` +
        `${existing.stripe_subscription_id} (status ${existing.status}). Ignorado.`,
    };
  }

  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (period) {
    patch.current_period_start = period.start;
    patch.current_period_end = period.end;
  }
  if (clearSubscriptionId) patch.stripe_subscription_id = null;
  else if (subscriptionId) patch.stripe_subscription_id = subscriptionId;

  if (existing) {
    // plan_id so muda quando foi resolvido com confianca.
    if (planId) patch.plan_id = planId;

    const { error } = await supabaseAdmin.from('subscriptions').update(patch).eq('id', existing.id);
    if (error) throw new DbError('update subscriptions', error);

    return {
      result: 'updated',
      subscription_row_id: existing.id,
      plan_changed: Boolean(planId) && planId !== existing.plan_id,
    };
  }

  // Sem linha: plan_id e NOT NULL, entao precisamos de um valor.
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from('subscriptions').insert({
    org_id: orgId,
    plan_id: planId ?? STARTER_PLAN_ID,
    status,
    current_period_start: period?.start ?? now,
    current_period_end:
      period?.end ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    stripe_subscription_id: clearSubscriptionId ? null : subscriptionId,
  });
  if (error) throw new DbError('insert subscriptions', error);

  return {
    result: 'inserted',
    warning: planId
      ? undefined
      : `Org ${orgId} nao tinha assinatura e o plano nao foi resolvido — inserido como Starter.`,
  };
}

// ---------------------------------------------------------------------------
// Handlers por evento
// ---------------------------------------------------------------------------

async function processEvent(event: Stripe.Event): Promise<Record<string, unknown>> {
  const object = event.data.object as Record<string, any>;

  let customerId: string | null = null;
  let subscriptionId: string | null = null;
  let metadataOrgId: string | null = null;
  let metadataPlanId: string | null = null;
  let status: string;
  let sub: Record<string, any> | null = null;

  switch (event.type) {
    case 'checkout.session.completed': {
      customerId = toId(object.customer);
      subscriptionId = toId(object.subscription);
      sub = await safeRetrieveSubscription(subscriptionId);
      // O metadata da sessao e o da subscription — o app grava na sessao, mas
      // Payment Links podem carregar no assinante.
      metadataOrgId = object.metadata?.org_id ?? sub?.metadata?.org_id ?? null;
      metadataPlanId = object.metadata?.plan_id ?? sub?.metadata?.plan_id ?? null;

      // Gate da Story 8.6b-2: boleto/PIX ficam past_due ate o invoice compensar.
      const paid =
        object.payment_status === 'paid' || object.payment_status === 'no_payment_required';
      status = paid ? 'active' : 'past_due';
      break;
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      sub = object;
      customerId = toId(object.customer);
      subscriptionId = toId(object.id);
      metadataOrgId = object.metadata?.org_id ?? null;
      metadataPlanId = object.metadata?.plan_id ?? null;
      status = mapStripeStatus(object.status);
      break;
    }

    case 'customer.subscription.deleted': {
      sub = object;
      customerId = toId(object.customer);
      subscriptionId = toId(object.id);
      metadataOrgId = object.metadata?.org_id ?? null;
      status = 'canceled';
      break;
    }

    case 'invoice.payment_succeeded':
    case 'invoice.payment_failed': {
      customerId = toId(object.customer);
      subscriptionId = getSubscriptionIdFromInvoice(object);
      sub = await safeRetrieveSubscription(subscriptionId);
      const invoiceSubMeta = object.parent?.subscription_details?.metadata;
      metadataOrgId =
        object.metadata?.org_id ?? invoiceSubMeta?.org_id ?? sub?.metadata?.org_id ?? null;
      metadataPlanId =
        object.metadata?.plan_id ?? invoiceSubMeta?.plan_id ?? sub?.metadata?.plan_id ?? null;
      status = event.type === 'invoice.payment_succeeded' ? 'active' : 'past_due';
      break;
    }

    default:
      return { result: 'ignored' };
  }

  const { orgId, via: orgVia } = await resolveOrgId(metadataOrgId, customerId);
  if (!orgId) {
    // Reenviar nao faz o dado aparecer — registramos e devolvemos 200.
    return {
      result: 'org_not_found',
      warning: `Nenhuma org para customer ${customerId ?? '(sem customer)'}.`,
      customer_id: customerId,
    };
  }

  await linkCustomerToOrg(orgId, customerId);

  const { priceId, unitAmount } = getPriceFromSubscription(sub);
  const { planId, via: planVia } = await resolvePlanId(metadataPlanId, priceId, unitAmount);

  const written = await writeSubscription({
    orgId,
    subscriptionId,
    status,
    planId,
    period: getPeriod(sub),
    clearSubscriptionId: event.type === 'customer.subscription.deleted',
  });

  return {
    org_id: orgId,
    org_via: orgVia,
    plan_id: planId,
    plan_via: planVia,
    status,
    subscription_id: subscriptionId,
    ...written,
    warning:
      written.warning ??
      (planId
        ? undefined
        : `Plano nao resolvido (price ${priceId ?? 'n/d'}, valor ${unitAmount ?? 'n/d'}) — plan_id preservado.`),
  };
}

// ---------------------------------------------------------------------------
// Entrypoint
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

  if (!STRIPE_WEBHOOK_SECRET) {
    log('error', 'STRIPE_WEBHOOK_SECRET ausente — impossivel validar assinatura');
    return errorResponse('Webhook secret not configured', 500);
  }

  // O corpo CRU e obrigatorio: req.json() reserializaria e quebraria a assinatura.
  const raw = await req.text();
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    log('error', 'Requisicao sem header stripe-signature');
    return errorResponse('Missing stripe-signature header', 400);
  }

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      raw,
      signature,
      STRIPE_WEBHOOK_SECRET,
      undefined,
      cryptoProvider,
    );
  } catch (err) {
    log('error', 'Assinatura invalida', {
      error: err instanceof Error ? err.message : String(err),
    });
    return errorResponse('Invalid signature', 400);
  }

  // Idempotencia sem corrida: inserimos ANTES de processar e usamos a violacao
  // de PK como sinal de duplicado (em vez de SELECT-depois-INSERT).
  const { error: insertError } = await supabaseAdmin
    .from('stripe_events')
    .insert({ id: event.id, type: event.type, payload: event as unknown as Record<string, unknown> });

  if (insertError) {
    if (insertError.code === '23505') {
      log('info', 'Evento duplicado ignorado', { event_id: event.id, event_type: event.type });
      return jsonResponse({ received: true, duplicate: true });
    }
    log('error', 'Falha ao registrar evento', {
      event_id: event.id,
      event_type: event.type,
      error: insertError.message,
    });
    return errorResponse('Database error', 500);
  }

  if (!HANDLED_EVENTS.has(event.type)) {
    log('info', 'Evento nao tratado', { event_id: event.id, event_type: event.type });
    return jsonResponse({ received: true, ignored: true });
  }

  try {
    const resolution = await processEvent(event);

    const { error: patchError } = await supabaseAdmin
      .from('stripe_events')
      .update({ payload: { ...(event as unknown as Record<string, unknown>), _resolution: resolution } })
      .eq('id', event.id);
    if (patchError) {
      // Auditoria falhou, mas a assinatura ja foi gravada — nao vale reprocessar.
      log('error', 'Falha ao gravar _resolution', {
        event_id: event.id,
        error: patchError.message,
      });
    }

    log('info', 'Evento processado', {
      event_id: event.id,
      event_type: event.type,
      ...resolution,
    });
    return jsonResponse({ received: true, ...resolution });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // Sem isto, o insert-first engoliria o reenvio da Stripe para sempre.
    const { error: cleanupError } = await supabaseAdmin
      .from('stripe_events')
      .delete()
      .eq('id', event.id);
    if (cleanupError) {
      log('error', 'Falha ao limpar stripe_events para permitir retry', {
        event_id: event.id,
        error: cleanupError.message,
      });
    }

    log('error', 'Erro ao processar evento', {
      event_id: event.id,
      event_type: event.type,
      error: message,
    });
    return errorResponse('Processing failed', 500);
  }
});
