import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { createUazapiClient } from '@/lib/sdr/uazapi'
import { createInstance } from '@/lib/uazapi-admin'

const BASE_URL = (process.env.UAZAPI_BASE_URL || 'https://nexioai.uazapi.com').replace(/\/$/, '')

// POST /api/sdr/connect — inicia conexão. QR code vem de GET /api/sdr/status.
export async function POST(request: NextRequest) {
  try {
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
    const companyId = userData.company_id

    let { data: config } = await service
      .from('sdr_configs')
      .select('id, uazapi_instance_url, uazapi_instance_name, uazapi_token, instance_status')
      .eq('company_id', companyId)
      .single()

    const body = await request.json().catch(() => ({}))

    // ── Criar/recriar instância se necessário ─────────────────────────────
    const needsCreate = !config?.uazapi_token || !config?.uazapi_instance_url

    if (needsCreate) {
      const instanceName = `empresa-${companyId}-${Date.now()}`
      const instance = await createInstance({ name: instanceName, companyId })
      const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/sdr/webhook/${companyId}`

      if (config) {
        await service.from('sdr_configs').update({
          uazapi_instance_url: BASE_URL,
          uazapi_instance_name: instanceName,
          uazapi_token: instance.token,   // armazenado sem criptografia
          instance_status: 'disconnected',
          instance_phone: null,
        }).eq('company_id', companyId)
      } else {
        await service.from('sdr_configs').insert({
          company_id: companyId,
          uazapi_instance_url: BASE_URL,
          uazapi_instance_name: instanceName,
          uazapi_token: instance.token,   // armazenado sem criptografia
          webhook_url: webhookUrl,
          agent_type: 'atendimento_venda',
          agente_ativo: false,
          instance_status: 'disconnected',
        })
      }

      await service.from('companies').update({
        whatsapp_instance_name: instanceName,
        whatsapp_instance: BASE_URL,
      }).eq('id', companyId)

      const { data: fresh } = await service
        .from('sdr_configs')
        .select('uazapi_instance_url, uazapi_token')
        .eq('company_id', companyId)
        .single()

      config = fresh as any
    }

    if (!config?.uazapi_token || !config?.uazapi_instance_url) {
      return NextResponse.json({ error: 'Falha ao criar instância. Verifique o UAZAPI_ADMIN_TOKEN em Admin → Configurações.' }, { status: 500 })
    }

    // Token armazenado como plain text — tenta descriptografar legado se necessário
    let token: string = config.uazapi_token
    if (token.includes(':') && token.split(':').length === 3) {
      // Formato legado criptografado — tenta decrypt, se falhar limpa e pede reconexão
      try {
        const { decrypt } = await import('@/lib/crypto')
        token = decrypt(config.uazapi_token)
      } catch {
        await service.from('sdr_configs').update({
          uazapi_token: null,
          uazapi_instance_url: null,
          uazapi_instance_name: null,
          instance_status: 'disconnected',
        }).eq('company_id', companyId)
        return NextResponse.json({
          error: 'Token legado inválido — foi resetado. Clique em conectar novamente.',
        }, { status: 503 })
      }
    }

    const client = createUazapiClient(config.uazapi_instance_url, token)

    // Garante que o webhook esteja configurado nessa instância
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/sdr/webhook/${companyId}`
    await client.setWebhook(webhookUrl, ['messages', 'connection']).catch(() => {})

    // Inicia conexão — se a instância foi auto-deletada (1h sem conectar), recria
    try {
      await client.connect(body.phone)
    } catch (uazErr: any) {
      const msg = uazErr.message ?? ''
      if (msg.includes('401') || msg.includes('404') || msg.toLowerCase().includes('not found')) {
        await service.from('sdr_configs').update({
          uazapi_token: null,
          uazapi_instance_url: null,
          uazapi_instance_name: null,
          instance_status: 'disconnected',
        }).eq('company_id', companyId)
        return NextResponse.json({
          error: 'Instância expirou no servidor WhatsApp. Clique em conectar novamente para recriar.',
        }, { status: 503 })
      }
      throw uazErr
    }

    await service.from('sdr_configs')
      .update({ instance_status: 'connecting' })
      .eq('company_id', companyId)

    return NextResponse.json({ ok: true, status: 'connecting' })

  } catch (err: any) {
    console.error('[SDR connect]', err)
    return NextResponse.json({ error: err.message || 'Erro ao conectar' }, { status: 500 })
  }
}

// DELETE /api/sdr/connect — desconecta a instância WhatsApp
export async function DELETE() {
  try {
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
      .single()

    if (!config?.uazapi_token || !config?.uazapi_instance_url) {
      return NextResponse.json({ error: 'Nenhuma instância encontrada' }, { status: 404 })
    }

    let token: string = config.uazapi_token
    if (token.includes(':') && token.split(':').length === 3) {
      try {
        const { decrypt } = await import('@/lib/crypto')
        token = decrypt(token)
      } catch { /* ignora erro de decrypt no token legado */ }
    }

    const client = createUazapiClient(config.uazapi_instance_url, token)
    await client.disconnect()

    await service
      .from('sdr_configs')
      .update({ instance_status: 'disconnected', instance_phone: null })
      .eq('company_id', userData.company_id)

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[SDR disconnect]', err)
    return NextResponse.json({ error: err.message || 'Erro ao desconectar' }, { status: 500 })
  }
}
