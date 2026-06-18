import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { createServiceClient } from '@/lib/supabase/server'

const GTPRO_BASE   = process.env.GTPRO_API_URL ?? 'https://gtpro.vendai.pro'
const ZAAPPLY_BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.zaapply.com.br'

// GET — inicia OAuth via GTPRO, retorna { url } para o cliente redirecionar
export async function GET(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const supabase = createServiceClient()
  const { data: cfg } = await supabase
    .from('sdr_configs')
    .select('gtpro_api_key')
    .eq('company_id', context.companyId)
    .maybeSingle()

  if (!cfg?.gtpro_api_key) {
    return NextResponse.json({ error: 'Configure a API Key do GTPRO antes de conectar o Meta.' }, { status: 424 })
  }

  const redirectBack = `${ZAAPPLY_BASE}/configuracoes?tab=integracoes`

  const res = await fetch(
    `${GTPRO_BASE}/api/meta/connect?redirect_back=${encodeURIComponent(redirectBack)}`,
    { headers: { Authorization: `Bearer ${cfg.gtpro_api_key}` }, cache: 'no-store' },
  )

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    return NextResponse.json({ error: body?.error ?? `Erro ${res.status} ao iniciar OAuth` }, { status: res.status })
  }

  const { url } = await res.json()
  return NextResponse.json({ url })
}
