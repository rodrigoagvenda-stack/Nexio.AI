import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { runRemarketingForCompany } from '@/lib/sdr/follow'

export async function POST(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  try {
    const result = await runRemarketingForCompany(context.companyId)
    return NextResponse.json({ ok: true, ...result })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
