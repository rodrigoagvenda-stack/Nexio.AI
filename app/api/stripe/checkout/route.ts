import { NextRequest, NextResponse } from 'next/server';
import { stripe, PLANS, PlanKey } from '@/lib/stripe';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/require-auth';

export async function POST(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request);
  if (authError) return authError;

  try {
    const { plan } = await request.json();

    if (!plan || !(plan in PLANS)) {
      return NextResponse.json({ error: 'Plano inválido' }, { status: 400 });
    }

    const planConfig = PLANS[plan as PlanKey];
    const service = createServiceClient();

    const { data: company } = await service
      .from('companies')
      .select('name, email, stripe_customer_id')
      .eq('id', context.companyId)
      .single();

    if (!company) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 });

    // Criar ou reusar customer Stripe
    let customerId = company.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: company.name,
        email: company.email,
        metadata: { company_id: String(context.companyId) },
      });
      customerId = customer.id;
      await service.from('companies').update({ stripe_customer_id: customerId }).eq('id', context.companyId);
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: planConfig.priceId, quantity: 1 }],
      success_url: `${appUrl}/configuracoes?checkout=success&plan=${plan}`,
      cancel_url: `${appUrl}/configuracoes?checkout=cancelled`,
      metadata: {
        company_id: String(context.companyId),
        plan,
      },
      subscription_data: {
        metadata: {
          company_id: String(context.companyId),
          plan,
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('[stripe/checkout]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
