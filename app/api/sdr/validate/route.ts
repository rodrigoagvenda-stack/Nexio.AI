import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/crypto'
import { validateSdr } from '@/lib/sdr/validator'

// POST /api/sdr/validate
// Valida o prompt do SDR antes da ativação. Chamada única na UI.
export async function POST(req: NextRequest) {
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

    const body = await req.json()
    const {
      persona,
      conhecimento_ativo,
      objecoes_ativo,
    } = body
    const agent_type: 'atendimento_venda' | 'atendimento_venda_agendamento' =
      body.agent_type === 'atendimento_venda_agendamento'
        ? 'atendimento_venda_agendamento'
        : 'atendimento_venda'

    const service = createServiceClient()

    // Resolve OpenAI key: env var → sdr_configs da empresa → platform_config global
    let openaiKey: string | null = null
    if (process.env.OPENAI_API_KEY) {
      openaiKey = process.env.OPENAI_API_KEY
    } else {
      const { data: cfg } = await service
        .from('sdr_configs')
        .select('openai_key')
        .eq('company_id', userData.company_id)
        .single()
      if (cfg?.openai_key) {
        openaiKey = decrypt(cfg.openai_key)
      } else {
        const { data: rows } = await service
          .from('platform_config')
          .select('key, value, is_encrypted')
          .eq('key', 'openai_api_key')
        const row = rows?.[0]
        if (row?.value) openaiKey = row.is_encrypted ? decrypt(row.value) : row.value
      }
    }

    if (!openaiKey) {
      return NextResponse.json({ error: 'Chave OpenAI não configurada' }, { status: 400 })
    }
    const nichoId: string = persona?.nicho_id ?? ''

    // Busca o flow ativo da empresa
    const { data: flowRow } = await service
      .from('sdr_flows')
      .select('id')
      .eq('company_id', userData.company_id)
      .eq('ativo', true)
      .limit(1)
      .single()

    // O conteúdo real do SDR é a Base de Conhecimento + Base de Objeções
    let builtPrompt = ''
    const _debug: Record<string, unknown> = { flow_id: flowRow?.id ?? null, docs_total: 0, doc_types: {} }

    if (flowRow?.id) {
      const { data: docs } = await service
        .from('documents')
        .select('content, metadata')
        .eq('company_id', userData.company_id)
        .contains('metadata', { flow_id: flowRow.id })
        .limit(150)

      _debug.docs_total = docs?.length ?? 0
      const byType: Record<string, number> = {}
      docs?.forEach(d => { const t = d.metadata?.doc_type ?? 'unknown'; byType[t] = (byType[t] ?? 0) + 1 })
      _debug.doc_types = byType

      if (docs && docs.length > 0) {
        const conhecimento = docs
          .filter((d) => d.metadata?.doc_type === 'conhecimento' || d.metadata?.doc_type === 'diagnostico_conhecimento')
          .map((d) => d.content).join('\n')
        const objecoes = docs
          .filter((d) => d.metadata?.doc_type === 'objecoes' || d.metadata?.doc_type === 'diagnostico_objecoes')
          .map((d) => d.content).join('\n')

        if (conhecimento) builtPrompt += `=== BASE DE CONHECIMENTO ===\n${conhecimento}`
        if (objecoes) builtPrompt += `\n\n=== BASE DE OBJEÇÕES ===\n${objecoes}`
      }
    }

    _debug.prompt_chars = builtPrompt.length
    _debug.prompt_preview = builtPrompt.slice(0, 300)
    console.log('[sdr/validate] debug:', JSON.stringify(_debug))

    if (!builtPrompt.trim()) {
      return NextResponse.json(
        { error: 'Configure a Base de Conhecimento antes de diagnosticar.', code: 'SEM_BASE' },
        { status: 400 }
      )
    }

    const result = await validateSdr({
      builtPrompt,
      openaiKey,
      nichoId,
      agentType: agent_type ?? 'atendimento_venda',
      persona: persona ?? {},
      conhecimentoAtivo: conhecimento_ativo ?? true,
      objecoesAtivo: objecoes_ativo ?? false,
    })

    return NextResponse.json({ ...result, _debug })
  } catch (err: any) {
    console.error('[sdr/validate]', err)
    return NextResponse.json({ error: err?.message ?? 'Erro interno' }, { status: 500 })
  }
}
