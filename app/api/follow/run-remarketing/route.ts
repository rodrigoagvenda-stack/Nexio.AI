import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { runRemarketingForCompany } from '@/lib/sdr/follow'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  try {
    const body = await req.json().catch(() => ({}))
    const force = body?.force === true
    const result = await runRemarketingForCompany(context.companyId, true, force)
    return NextResponse.json({ ok: true, ...result })
  } catch (err: any) {
    console.error('[run-remarketing]', err)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
