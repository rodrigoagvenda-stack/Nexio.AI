import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/crypto'
import { NICHES, interpolate } from '@/lib/sdr/templates'
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
    const { data: cfg } = await service
      .from('sdr_configs')
      .select('openai_key')
      .eq('company_id', userData.company_id)
      .single()

    if (!cfg?.openai_key) {
      return NextResponse.json({ error: 'Chave OpenAI não configurada' }, { status: 400 })
    }

    const openaiKey = decrypt(cfg.openai_key)
    const nichoId: string = persona?.nicho_id ?? ''

    // Monta o prompt completo (igual ao engine.ts)
    const niche = NICHES.find((n) => n.id === nichoId)
    const vars = {
      nome_agente: persona?.nome_agente ?? '',
      nome_empresa: persona?.empresa ?? '',
      descricao_produto: persona?.produto ?? '',
      tom_agente: persona?.tom ?? '',
      url_empresa: persona?.url_empresa ?? '',
      preco: persona?.preco ?? '',
      periodo_teste: persona?.periodo_teste ?? '',
      link_teste: persona?.link_teste ?? '',
      link_playlist: persona?.link_playlist ?? '',
      link_agendamento: persona?.link_agendamento ?? '',
      link_catalogo: persona?.link_catalogo ?? '',
      link_pedido: persona?.link_pedido ?? '',
      endereco: persona?.endereco ?? '',
      horario: persona?.horario ?? '',
      taxa_entrega: persona?.taxa_entrega ?? '',
      tempo_entrega: persona?.tempo_entrega ?? '',
      area_entrega: persona?.area_entrega ?? '',
      formas_pagamento: persona?.formas_pagamento ?? '',
      valor_minimo_pedido: persona?.valor_minimo_pedido ?? '',
      pedido_tipo: persona?.pedido_tipo ?? '',
    }

    const rawTemplate = niche
      ? `${interpolate(niche.conhecimento, vars)}\n\n${interpolate(niche.objecoes, vars)}`
      : JSON.stringify(persona, null, 2)

    const result = await validateSdr({
      builtPrompt: rawTemplate,
      openaiKey,
      nichoId,
      agentType: agent_type ?? 'atendimento_venda',
      persona: persona ?? {},
      conhecimentoAtivo: conhecimento_ativo ?? true,
      objecoesAtivo: objecoes_ativo ?? false,
    })

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[sdr/validate]', err)
    return NextResponse.json({ error: err?.message ?? 'Erro interno' }, { status: 500 })
  }
}
