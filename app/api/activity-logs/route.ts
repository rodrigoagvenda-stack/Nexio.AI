import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/require-auth';

export async function POST(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { action, description, metadata } = body;

    if (!action) {
      return NextResponse.json({ success: false, message: 'action é obrigatório' }, { status: 400 });
    }

    const serviceSupabase = createServiceClient();

    const { error } = await serviceSupabase.from('activity_logs').insert({
      user_id: context.userId,
      company_id: context.companyId,
      action,
      description,
      metadata,
    });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('activity-logs error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
