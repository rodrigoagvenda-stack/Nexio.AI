import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { encrypt, decrypt } from '@/lib/crypto'

// GET /api/sdr/config : lê config SDR da empresa do usuário logado
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
    const [{ data: config, error }, { data: flows }] = await Promise.all([
      service.from('sdr_configs').select('*').eq('company_id', userData.company_id).single(),
      service.from('sdr_flows').select('*').eq('company_id', userData.company_id).eq('ativo', true).limit(1),
    ])

    if (error && error.code !== 'PGRST116') throw error

    if (!config) return NextResponse.json({ config: null })

    const flow = flows?.[0] ?? null

    return NextResponse.json({
      config: {
        id: config.id,
        company_id: config.company_id,
        agent_type: config.agent_type,
        // orchestrator_prompt from sdr_flows is the source of truth; fallback to sdr_configs.prompt
        prompt: flow?.orchestrator_prompt ?? config.prompt ?? '',
        agente_ativo: config.agente_ativo,
        uazapi_instance_name: config.uazapi_instance_name,
        uazapi_instance_url: config.uazapi_instance_url,
        uazapi_token: config.uazapi_token ? '••••••••' : null,
        google_calendar_id: config.google_calendar_id,
        openai_key: config.openai_key ? '••••••••' : null,
        webhook_url: config.webhook_url,
        instance_status: config.instance_status,
        instance_phone: config.instance_phone,
        // vector fields live in sdr_flows
        vector_table_conhecimento: flow?.vector_table_conhecimento ?? null,
        vector_table_objecoes: flow?.vector_table_objecoes ?? null,
        conhecimento_ativo: flow?.conhecimento_ativo ?? true,
        objecoes_ativo: flow?.objecoes_ativo ?? false,
        flow_id: flow?.id ?? null,
        inbox_mode: flow?.inbox_mode ?? 'suporte',
        event_title_template: flow?.event_title_template ?? null,
        whatsapp_provider: config.whatsapp_provider ?? 'uazapi',
        meta_wa_phone_number_id: config.meta_wa_phone_number_id ?? null,
        meta_wa_waba_id: config.meta_wa_waba_id ?? null,
        meta_wa_token: config.meta_wa_token ? '••••••••' : null,
        meta_pixel_id: config.meta_pixel_id ?? null,
        meta_pixel_token: config.meta_pixel_token ? '••••••••' : null,
        created_at: config.created_at,
        updated_at: config.updated_at,
      },
    })
  } catch (err: any) {
    console.error('[SDR config GET]', err)
    return NextResponse.json({ error: err.message || 'Erro ao buscar config' }, { status: 500 })
  }
}

// PUT /api/sdr/config : cria ou atualiza config SDR da empresa
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
      vector_table_conhecimento,
      vector_table_objecoes,
      conhecimento_ativo,
      objecoes_ativo,
      inbox_mode,
      event_title_template,
      meta_pixel_id,
      meta_pixel_token,
    } = body

    const service = createServiceClient()
    const companyId = userData.company_id

    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/sdr/webhook/${companyId}`

    const { data: existing } = await service
      .from('sdr_configs')
      .select('id, uazapi_token, openai_key')
      .eq('company_id', companyId)
      .single()

    // ── sdr_configs: credentials + agente_ativo ──────────────────
    const configUpdates: Record<string, any> = {
      company_id: companyId,
      webhook_url: webhookUrl,
    }

    if (agent_type !== undefined) configUpdates.agent_type = agent_type
    if (agente_ativo !== undefined) configUpdates.agente_ativo = agente_ativo
    if (uazapi_instance_name !== undefined) configUpdates.uazapi_instance_name = uazapi_instance_name
    if (uazapi_instance_url !== undefined) configUpdates.uazapi_instance_url = uazapi_instance_url
    if (google_calendar_id !== undefined) configUpdates.google_calendar_id = google_calendar_id
    if (meta_pixel_id !== undefined) configUpdates.meta_pixel_id = meta_pixel_id || null
    if (meta_pixel_token && !meta_pixel_token.startsWith('••')) {
      configUpdates.meta_pixel_token = meta_pixel_token
    }

    if (uazapi_token && !uazapi_token.startsWith('••')) {
      configUpdates.uazapi_token = encrypt(uazapi_token)
    }
    if (openai_key && !openai_key.startsWith('••')) {
      configUpdates.openai_key = encrypt(openai_key)
    }

    let result
    if (existing) {
      const { data, error } = await service
        .from('sdr_configs')
        .update(configUpdates)
        .eq('id', existing.id)
        .select()
        .single()
      if (error) throw error
      result = data
    } else {
      const { data, error } = await service
        .from('sdr_configs')
        .insert(configUpdates)
        .select()
        .single()
      if (error) throw error
      result = data
    }

    // ── companies: sincroniza agente_ativo (fonte de verdade lida pelo engine) ──
    if (agente_ativo !== undefined) {
      await service.from('companies').update({ agente_ativo }).eq('id', companyId)
    }

    // ── sdr_flows: orchestrator_prompt + RAG fields (source of truth) ──
    const { data: existingFlow } = await service
      .from('sdr_flows')
      .select('id')
      .eq('company_id', companyId)
      .eq('ativo', true)
      .limit(1)
      .single()

    const flowUpdates: Record<string, any> = {}
    if (prompt !== undefined) flowUpdates.orchestrator_prompt = prompt
    if (vector_table_conhecimento !== undefined) flowUpdates.vector_table_conhecimento = vector_table_conhecimento || null
    if (vector_table_objecoes !== undefined) flowUpdates.vector_table_objecoes = vector_table_objecoes || null
    if (conhecimento_ativo !== undefined) flowUpdates.conhecimento_ativo = conhecimento_ativo
    if (objecoes_ativo !== undefined) flowUpdates.objecoes_ativo = objecoes_ativo
    if (inbox_mode !== undefined) flowUpdates.inbox_mode = inbox_mode
    if (event_title_template !== undefined) flowUpdates.event_title_template = event_title_template || null

    let flowId: string | null = existingFlow?.id ?? null

    if (Object.keys(flowUpdates).length > 0) {
      if (existingFlow) {
        await service.from('sdr_flows').update(flowUpdates).eq('id', existingFlow.id)
      } else {
        const { data: newFlow } = await service.from('sdr_flows').insert({
          company_id: companyId,
          nome: 'Principal',
          uazapi_instance: '',
          numero_whatsapp: '',
          tipo: 'ambos',
          ativo: true,
          ...flowUpdates,
        }).select('id').single()
        flowId = newFlow?.id ?? null
      }
    }

    return NextResponse.json({
      config: {
        ...result,
        uazapi_token: result.uazapi_token ? '••••••••' : null,
        openai_key: result.openai_key ? '••••••••' : null,
        flow_id: flowId,
      },
    })
  } catch (err: any) {
    console.error('[SDR config PUT]', err)
    return NextResponse.json({ error: err.message || 'Erro ao salvar config' }, { status: 500 })
  }
}
