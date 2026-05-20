import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { createUazapiClient } from '@/lib/sdr/uazapi'

/**
 * POST /api/sdr/fix-webhook
 * Re-registra o webhook correto (/api/webhook/nexio) na instância uazapi da empresa.
 * Útil para empresas que foram conectadas com a URL antiga (/api/sdr/webhook/[id]).
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: userData } = await supabase
    .from('users')
    .select('company_id')
    .eq('auth_user_id', user.id)
    .single()

  if (!userData) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

  const service = createServiceClient()
  const { data: config } = await service
    .from('sdr_configs')
    .select('uazapi_instance_url, uazapi_token')
    .eq('company_id', userData.company_id)
    .maybeSingle()

  if (!config?.uazapi_token || !config?.uazapi_instance_url) {
    return NextResponse.json({ error: 'Instância não configurada' }, { status: 404 })
  }

  let token = config.uazapi_token
  if (token.includes(':') && token.split(':').length === 3) {
    try {
      const { decrypt } = await import('@/lib/crypto')
      token = decrypt(token)
    } catch { /* ignora token legado inválido */ }
  }

  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/nexio`
  console.log(`[fix-webhook] empresa=${userData.company_id} → ${webhookUrl}`)

  const client = createUazapiClient(config.uazapi_instance_url, token)
  await client.setWebhook(webhookUrl)

  return NextResponse.json({ ok: true, webhookUrl })
}
