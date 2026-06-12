import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { createServiceClient } from '@/lib/supabase/server'

const VALID_PLATFORMS = ['mercadopago', 'kiwify'] as const
type Platform = typeof VALID_PLATFORMS[number]

// GET — lista integrações da empresa (sem expor tokens)
export async function GET() {
  const auth = await requireAuth()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('payment_integrations')
    .select('platform, active, created_at')
    .eq('company_id', auth.companyId)

  if (error) {
    console.error('[payment-integrations:GET]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ integrations: data ?? [], companyId: auth.companyId })
}

// POST — salva/atualiza credenciais de uma plataforma
export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const body = await req.json().catch(() => null)
  const { platform, config } = body ?? {}

  if (!VALID_PLATFORMS.includes(platform as Platform)) {
    return NextResponse.json({ error: 'Plataforma inválida' }, { status: 400 })
  }

  // Validação mínima por plataforma
  if (platform === 'mercadopago' && (!config?.access_token || !config?.secret_key)) {
    return NextResponse.json({ error: 'access_token e secret_key são obrigatórios para Mercado Pago' }, { status: 400 })
  }
  if (platform === 'kiwify' && !config?.token) {
    return NextResponse.json({ error: 'token é obrigatório para Kiwify' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('payment_integrations')
    .upsert(
      { company_id: auth.companyId, platform, config, active: true, updated_at: new Date().toISOString() },
      { onConflict: 'company_id,platform' }
    )

  if (error) {
    console.error(`[payment-integrations:POST] platform=${platform}`, error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log(`[payment-integrations] company=${auth.companyId} platform=${platform} configurado`)
  return NextResponse.json({ success: true })
}

// DELETE — remove integração
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const body = await req.json().catch(() => null)
  const { platform } = body ?? {}

  if (!VALID_PLATFORMS.includes(platform as Platform)) {
    return NextResponse.json({ error: 'Plataforma inválida' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('payment_integrations')
    .delete()
    .eq('company_id', auth.companyId)
    .eq('platform', platform)

  if (error) {
    console.error(`[payment-integrations:DELETE] platform=${platform}`, error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log(`[payment-integrations] company=${auth.companyId} platform=${platform} removido`)
  return NextResponse.json({ success: true })
}
