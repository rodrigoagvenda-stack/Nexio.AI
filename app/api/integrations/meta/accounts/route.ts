import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { createServiceClient } from '@/lib/supabase/server'

const GTPRO_BASE = process.env.GTPRO_API_URL ?? 'https://gtpro.vendai.pro'

async function getGtproKey(companyId: number) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('sdr_configs')
    .select('gtpro_api_key')
    .eq('company_id', companyId)
    .maybeSingle()
  return data?.gtpro_api_key ?? null
}

// GET — lista contas de anúncio conectadas
export async function GET(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const key = await getGtproKey(context.companyId)
  if (!key) return NextResponse.json({ error: 'gtpro_not_connected' }, { status: 424 })

  const res = await fetch(`${GTPRO_BASE}/api/meta/accounts`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: 'no-store',
  })

  return NextResponse.json(await res.json(), { status: res.status })
}

// PATCH — define conta ativa { id }
export async function PATCH(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const key = await getGtproKey(context.companyId)
  if (!key) return NextResponse.json({ error: 'gtpro_not_connected' }, { status: 424 })

  const body = await req.json()
  const res = await fetch(`${GTPRO_BASE}/api/meta/accounts`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  return NextResponse.json(await res.json(), { status: res.status })
}
