import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/require-auth';

export async function GET(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request);
  if (authError) return authError;

  const service = createServiceClient();

  const { data } = await service
    .from('google_ads_integrations')
    .select('email, customer_id, conversion_action_id, expires_at, updated_at')
    .eq('company_id', context.companyId)
    .single();

  return NextResponse.json({
    connected: !!data,
    email: data?.email || null,
    customer_id: data?.customer_id || null,
    conversion_action_id: data?.conversion_action_id || null,
    expires_at: data?.expires_at || null,
  });
}

export async function DELETE(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request);
  if (authError) return authError;

  const service = createServiceClient();
  await service.from('google_ads_integrations').delete().eq('company_id', context.companyId);

  return NextResponse.json({ success: true });
}
