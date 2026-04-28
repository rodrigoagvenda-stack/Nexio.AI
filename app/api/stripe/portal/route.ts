import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/require-auth';

export async function POST(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request);
  if (authError) return authError;

  try {
    const service = createServiceClient();

    const { data: company } = await service
      .from('companies')
      .select('stripe_customer_id')
      .eq('id', context.companyId)
      .single();

    if (!company?.stripe_customer_id) {
      return NextResponse.json({ error: 'Sem assinatura ativa' }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const session = await stripe.billingPortal.sessions.create({
      customer: company.stripe_customer_id,
      return_url: `${appUrl}/configuracoes`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('[stripe/portal]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
