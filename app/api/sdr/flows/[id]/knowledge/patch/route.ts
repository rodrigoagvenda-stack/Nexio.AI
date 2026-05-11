import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getPlatformConfig } from '@/lib/platform-config'
import type OpenAI from 'openai'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data: userData } = await supabase
      .from('users').select('company_id').eq('auth_user_id', user.id).single()
    if (!userData) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    const service = createServiceClient()
    const { data: flow } = await service
      .from('sdr_flows').select('id').eq('id', params.id).eq('company_id', userData.company_id).single()
    if (!flow) return NextResponse.json({ error: 'Fluxo não encontrado' }, { status: 404 })

    const { correction, type = 'conhecimento', userMsg, sdrMsg } = await request.json() as {
      correction: string
      type?: 'conhecimento' | 'objecoes'
      userMsg?: string
      sdrMsg?: string
    }
    if (!correction?.trim()) return NextResponse.json({ error: 'Correção vazia' }, { status: 400 })

    const platformConfig = await getPlatformConfig()
    const openaiKey = platformConfig?.openai_api_key
    if (!openaiKey) {
      return NextResponse.json(
        { error: 'Chave OpenAI não configurada.' },
        { status: 422 }
      )
    }

    const { default: OpenAI } = await import('openai')
    const openai = new OpenAI({ apiKey: openaiKey })

    // Expand the correction into a concrete instruction for the agent
    const expandPrompt = `Você é um especialista em SDR. Uma avaliação identificou um erro numa resposta do agente.

Erro identificado: "${correction}"
${userMsg ? `\nMensagem do lead: "${userMsg}"` : ''}
${sdrMsg ? `\nResposta com erro: "${sdrMsg}"` : ''}

Escreva UMA instrução clara e concreta para o agente corrigir esse comportamento.
Máximo 3 linhas. Use formato de regra direta ("Sempre X", "Nunca Y", "Quando Z, faça W").
Não explique o motivo — só diga o que fazer.`

    const res = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [{ role: 'user', content: expandPrompt }],
      temperature: 0.2,
      max_tokens: 150,
    })

    const instruction = res.choices[0]?.message?.content?.trim() ?? correction

    const correctionText = `=== CORREÇÃO DE COMPORTAMENTO ===\n${instruction}\n\n[Identificada em simulação — aplicar imediatamente]`

    // Embed the correction chunk
    const embRes = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: [correctionText],
    })
    const embedding = embRes.data[0]?.embedding
    if (!embedding) throw new Error('Falha ao gerar embedding')

    // INSERT only — does not delete existing chunks
    const { error: insertError } = await service.from('documents').insert({
      company_id: userData.company_id,
      content: correctionText,
      embedding,
      metadata: {
        flow_id: params.id,
        doc_type: type,
        filename: `correcao_${Date.now()}.txt`,
        chunk_index: 0,
        is_correction: true,
      },
    })
    if (insertError) throw new Error(`Erro ao salvar: ${insertError.message}`)

    return NextResponse.json({ ok: true, instruction })
  } catch (err: any) {
    console.error('[knowledge/patch]', err)
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}
