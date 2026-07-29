import { NextRequest, NextResponse } from 'next/server';
import { getStripe, getPlanByPriceId, PLANS } from '@/lib/stripe';
import { createServiceClient } from '@/lib/supabase/server';
import Stripe from 'stripe';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature')!;
  const stripe = getStripe();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    console.error('[stripe/webhook] Invalid signature:', err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const service = createServiceClient();

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const companyId = parseInt(session.metadata?.company_id || '0');
      const plan = session.metadata?.plan;

      if (!companyId || !plan) break;

      const planConfig = PLANS[plan as keyof typeof PLANS];
      if (!planConfig) break;

      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);

      await service.from('companies').update({
        plan_type: plan,
        plan_monthly_limit: planConfig.tokensLimit,
        tokens_limit: planConfig.tokensLimit,
        is_active: true,
        subscription_expires_at: expiresAt.toISOString(),
        stripe_subscription_id: session.subscription as string,
      }).eq('id', companyId);

      console.log(`[Stripe] Empresa ${companyId} ativada no plano ${plan}`);
      break;
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice;
      const subDetails = invoice.parent?.subscription_details;
      const subscriptionId = typeof subDetails?.subscription === 'string'
        ? subDetails.subscription
        : subDetails?.subscription?.id;
      if (!subscriptionId) break;

      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      const companyId = parseInt(sub.metadata?.company_id || '0');
      if (!companyId) break;

      const priceId = sub.items.data[0]?.price.id;
      const plan = getPlanByPriceId(priceId);
      if (!plan) break;

      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);

      await service.from('companies').update({
        is_active: true,
        subscription_expires_at: expiresAt.toISOString(),
        tokens_used: 0,
        tokens_reset_at: new Date().toISOString(),
      }).eq('id', companyId);

      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const subDetails2 = invoice.parent?.subscription_details;
      const subscriptionId2 = typeof subDetails2?.subscription === 'string'
        ? subDetails2.subscription
        : subDetails2?.subscription?.id;
      if (!subscriptionId2) break;

      const sub = await stripe.subscriptions.retrieve(subscriptionId2);
      const companyId = parseInt(sub.metadata?.company_id || '0');
      if (!companyId) break;

      await service.from('companies').update({ is_active: false }).eq('id', companyId);
      console.log(`[Stripe] Empresa ${companyId} bloqueada : pagamento falhou`);
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const companyId = parseInt(sub.metadata?.company_id || '0');
      if (!companyId) break;

      await service.from('companies').update({
        is_active: false,
        plan_type: 'basic',
        agente_ativo: false,
      }).eq('id', companyId);

      console.log(`[Stripe] Empresa ${companyId} cancelou assinatura`);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
