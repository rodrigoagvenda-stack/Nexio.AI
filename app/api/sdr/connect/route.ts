import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { decrypt, encrypt } from '@/lib/crypto'
import { createUazapiClient } from '@/lib/sdr/uazapi'
import { createInstance } from '@/lib/uazapi-admin'

const BASE_URL = (process.env.UAZAPI_BASE_URL || 'https://nexioai.uazapi.com').replace(/\/$/, '')

// POST /api/sdr/connect
// Body: { phone?: string }
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

    // ── Auto-criar instância se não existe token/instância ────────────────
    if (!config?.uazapi_token || !config?.uazapi_instance_url) {
      const instanceName = `empresa-${companyId}-${Date.now()}`
      const instance = await createInstance({ name: instanceName, companyId })
      const encryptedToken = encrypt(instance.token)
      const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/sdr/webhook/${companyId}`

      if (config) {
        await service.from('sdr_configs').update({
          uazapi_instance_url: BASE_URL,
          uazapi_instance_name: instanceName,
          uazapi_token: encryptedToken,
          instance_status: 'disconnected',
          instance_phone: null,
        }).eq('company_id', companyId)
      } else {
        await service.from('sdr_configs').insert({
          company_id: companyId,
          uazapi_instance_url: BASE_URL,
          uazapi_instance_name: instanceName,
          uazapi_token: encryptedToken,
          webhook_url: webhookUrl,
          agent_type: 'atendimento_venda',
          agente_ativo: false,
          instance_status: 'disconnected',
        })
      }

      // Salva instance_name na tabela companies para identificação no n8n
      await service.from('companies').update({
        whatsapp_instance_name: instanceName,
        whatsapp_instance: BASE_URL,
      }).eq('id', companyId)

      // Recarrega config atualizada
      const { data: fresh } = await service
        .from('sdr_configs')
        .select('uazapi_instance_url, uazapi_token')
        .eq('company_id', companyId)
        .single()

      config = fresh as any
    }

    if (!config?.uazapi_token || !config?.uazapi_instance_url) {
      return NextResponse.json({ error: 'Falha ao criar instância. Tente novamente.' }, { status: 500 })
    }

    const token = decrypt(config.uazapi_token)
    const client = createUazapiClient(config.uazapi_instance_url, token)

    const body = await request.json().catch(() => ({}))
    const result = await client.connect(body.phone)

    return NextResponse.json(result)
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

    const token = decrypt(config.uazapi_token)
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
