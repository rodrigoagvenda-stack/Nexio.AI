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

// GET : status da conexão Meta (proxied via GTPRO)
export async function GET(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const key = await getGtproKey(context.companyId)
  if (!key) return NextResponse.json({ connected: false, ad_account_id: null })

  const res = await fetch(`${GTPRO_BASE}/api/meta/status`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: 'no-store',
  })
  if (!res.ok) return NextResponse.json({ connected: false, ad_account_id: null })

  return NextResponse.json(await res.json())
}

// DELETE : desconecta Meta (proxied via GTPRO)
export async function DELETE(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const key = await getGtproKey(context.companyId)
  if (!key) return NextResponse.json({ ok: true })

  await fetch(`${GTPRO_BASE}/api/meta/status`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${key}` },
  })

  return NextResponse.json({ ok: true })
}
