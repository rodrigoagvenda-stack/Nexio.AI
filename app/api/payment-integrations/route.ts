import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { createServiceClient } from '@/lib/supabase/server'

const VALID_PLATFORMS = ['mercadopago', 'kiwify', 'asaas'] as const
type Platform = typeof VALID_PLATFORMS[number]

export async function GET(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('payment_integrations')
    .select('platform, active, created_at')
    .eq('company_id', context.companyId)

  if (error) {
    console.error('[payment-integrations:GET]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ integrations: data ?? [], companyId: context.companyId })
}

export async function POST(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const body = await req.json().catch(() => null)
  const { platform, config } = body ?? {}

  if (!VALID_PLATFORMS.includes(platform as Platform)) {
    return NextResponse.json({ error: 'Plataforma inválida' }, { status: 400 })
  }

  if (platform === 'mercadopago' && (!config?.access_token || !config?.secret_key)) {
    return NextResponse.json({ error: 'access_token e secret_key são obrigatórios para Mercado Pago' }, { status: 400 })
  }
  if (platform === 'kiwify' && !config?.token) {
    return NextResponse.json({ error: 'token é obrigatório para Kiwify' }, { status: 400 })
  }
  if (platform === 'asaas' && (!config?.access_token || !config?.webhook_token)) {
    return NextResponse.json({ error: 'access_token e webhook_token são obrigatórios para Asaas' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('payment_integrations')
    .upsert(
      { company_id: context.companyId, platform, config, active: true, updated_at: new Date().toISOString() },
      { onConflict: 'company_id,platform' }
    )

  if (error) {
    console.error(`[payment-integrations:POST] platform=${platform}`, error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const body = await req.json().catch(() => null)
  const { platform } = body ?? {}

  if (!VALID_PLATFORMS.includes(platform as Platform)) {
    return NextResponse.json({ error: 'Plataforma inválida' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('payment_integrations')
    .delete()
    .eq('company_id', context.companyId)
    .eq('platform', platform)

  if (error) {
    console.error(`[payment-integrations:DELETE] platform=${platform}`, error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
