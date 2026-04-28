import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { encrypt, decrypt } from '@/lib/crypto'

// GET /api/sdr/config — lê config SDR da empresa do usuário logado
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data: userData } = await supabase
      .from('users')
      .select('company_id, role')
      .eq('auth_user_id', user.id)
      .single()

    if (!userData) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    const service = createServiceClient()
    const { data: config, error } = await service
      .from('sdr_configs')
      .select('*')
      .eq('company_id', userData.company_id)
      .single()

    if (error && error.code !== 'PGRST116') throw error

    if (!config) return NextResponse.json({ config: null })

    return NextResponse.json({
      config: {
        id: config.id,
        company_id: config.company_id,
        agent_type: config.agent_type,
        prompt: config.prompt,
        agente_ativo: config.agente_ativo,
        uazapi_instance_name: config.uazapi_instance_name,
        uazapi_instance_url: config.uazapi_instance_url,
        uazapi_token: config.uazapi_token ? '••••••••' : null,
        google_calendar_id: config.google_calendar_id,
        openai_key: config.openai_key ? '••••••••' : null,
        webhook_url: config.webhook_url,
        instance_status: config.instance_status,
        instance_phone: config.instance_phone,
        created_at: config.created_at,
        updated_at: config.updated_at,
      },
    })
  } catch (err: any) {
    console.error('[SDR config GET]', err)
    return NextResponse.json({ error: err.message || 'Erro ao buscar config' }, { status: 500 })
  }
}

// PUT /api/sdr/config — cria ou atualiza config SDR da empresa
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data: userData } = await supabase
      .from('users')
      .select('company_id, role')
      .eq('auth_user_id', user.id)
      .single()

    if (!userData) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    const body = await request.json()
    const {
      agent_type,
      prompt,
      agente_ativo,
      uazapi_instance_name,
      uazapi_instance_url,
      uazapi_token,
      google_calendar_id,
      openai_key,
    } = body

    const service = createServiceClient()
    const companyId = userData.company_id

    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/sdr/webhook/${companyId}`

    const { data: existing } = await service
      .from('sdr_configs')
      .select('id, uazapi_token, openai_key')
      .eq('company_id', companyId)
      .single()

    const updates: Record<string, any> = {
      company_id: companyId,
      webhook_url: webhookUrl,
    }

    if (agent_type !== undefined) updates.agent_type = agent_type
    if (prompt !== undefined) updates.prompt = prompt
    if (agente_ativo !== undefined) updates.agente_ativo = agente_ativo
    if (uazapi_instance_name !== undefined) updates.uazapi_instance_name = uazapi_instance_name
    if (uazapi_instance_url !== undefined) updates.uazapi_instance_url = uazapi_instance_url
    if (google_calendar_id !== undefined) updates.google_calendar_id = google_calendar_id

    if (uazapi_token && !uazapi_token.startsWith('••')) {
      updates.uazapi_token = encrypt(uazapi_token)
    }
    if (openai_key && !openai_key.startsWith('••')) {
      updates.openai_key = encrypt(openai_key)
    }

    let result
    if (existing) {
      const { data, error } = await service
        .from('sdr_configs')
        .update(updates)
        .eq('id', existing.id)
        .select()
        .single()
      if (error) throw error
      result = data
    } else {
      const { data, error } = await service
        .from('sdr_configs')
        .insert(updates)
        .select()
        .single()
      if (error) throw error
      result = data
    }

    return NextResponse.json({
      config: {
        ...result,
        uazapi_token: result.uazapi_token ? '••••••••' : null,
        openai_key: result.openai_key ? '••••••••' : null,
      },
    })
  } catch (err: any) {
    console.error('[SDR config PUT]', err)
    return NextResponse.json({ error: err.message || 'Erro ao salvar config' }, { status: 500 })
  }
}
