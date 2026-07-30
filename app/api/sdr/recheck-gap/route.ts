import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/crypto'
import { SCENARIO_DEFS, recheckScenario } from '@/lib/sdr/validator'

export const runtime = 'nodejs'
export const maxDuration = 30

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
    const { scenario_id } = body as { scenario_id: string }

    const def = SCENARIO_DEFS.find((s) => s.id === scenario_id)
    if (!def) return NextResponse.json({ error: 'Cenário não encontrado' }, { status: 400 })

    const service = createServiceClient()

    // Resolve OpenAI key
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
    if (!openaiKey) return NextResponse.json({ error: 'Chave OpenAI não configurada' }, { status: 400 })

    // Lê conteúdo atual do banco
    const { data: flowRow } = await service
      .from('sdr_flows')
      .select('id')
      .eq('company_id', userData.company_id)
      .eq('ativo', true)
      .limit(1)
      .single()

    if (!flowRow?.id) {
      return NextResponse.json({ covered: false, reason: 'Nenhum fluxo ativo encontrado' })
    }

    const { data: docs } = await service
      .from('documents')
      .select('content, metadata')
      .eq('company_id', userData.company_id)
      .contains('metadata', { flow_id: flowRow.id })
      .order('created_at', { ascending: true })
      .limit(150)

    let builtPrompt = ''
    if (docs && docs.length > 0) {
      const conhecimento = docs
        .filter((d) => d.metadata?.doc_type === 'conhecimento' || d.metadata?.doc_type === 'diagnostico_conhecimento')
        .map((d) => d.content)
        .join('\n')
      const objecoes = docs
        .filter((d) => d.metadata?.doc_type === 'objecoes' || d.metadata?.doc_type === 'diagnostico_objecoes')
        .map((d) => d.content)
        .join('\n')
      if (conhecimento) builtPrompt += `=== BASE DE CONHECIMENTO ===\n${conhecimento}`
      if (objecoes) builtPrompt += `\n\n=== BASE DE OBJEÇÕES ===\n${objecoes}`
    }

    if (!builtPrompt.trim()) {
      return NextResponse.json({ covered: false, reason: 'Base de conhecimento vazia' })
    }

    const result = await recheckScenario(def, builtPrompt, openaiKey)
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[sdr/recheck-gap]', err)
    return NextResponse.json({ error: err?.message ?? 'Erro interno' }, { status: 500 })
  }
}
