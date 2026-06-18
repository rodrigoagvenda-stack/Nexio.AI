import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { createServiceClient } from '@/lib/supabase/server'

// GET  — lista ad accounts da BM usando o token armazenado
// POST — salva a conta selecionada
export async function GET(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const supabase = createServiceClient()
  const { data: cfg } = await supabase
    .from('sdr_configs')
    .select('meta_access_token')
    .eq('company_id', context.companyId)
    .maybeSingle()

  if (!cfg?.meta_access_token) {
    return NextResponse.json({ error: 'meta_not_connected' }, { status: 424 })
  }

  const res = await fetch(
    `https://graph.facebook.com/v25.0/me/adaccounts?fields=id,name,account_status&limit=50` +
    `&access_token=${cfg.meta_access_token}`,
  )
  const data = await res.json()
  if (data.error) {
    return NextResponse.json({ error: data.error.message }, { status: 400 })
  }

  const accounts = (data.data ?? []).map((a: any) => ({
    id:     a.id,          // act_123456
    name:   a.name,
    active: a.account_status === 1,
  }))

  return NextResponse.json({ accounts })
}

export async function POST(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const body = await req.json().catch(() => ({}))
  const { account_id, account_name } = body

  if (!account_id) return NextResponse.json({ error: 'account_id obrigatório' }, { status: 400 })

  const supabase = createServiceClient()
  await supabase
    .from('sdr_configs')
    .update({ meta_ad_account_id: account_id, meta_ad_account_name: account_name ?? account_id })
    .eq('company_id', context.companyId)

  return NextResponse.json({ ok: true })
}
