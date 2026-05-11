import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { NICHE_MAP, interpolate, type SdrVariables } from '@/lib/sdr/templates'
import { getPlatformConfig } from '@/lib/platform-config'
import type OpenAI from 'openai'

export const runtime = 'nodejs'
export const maxDuration = 60

interface SimMessage { role: 'user' | 'assistant'; content: string }

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const body = await request.json()
    const { nicheId, variables, history, userMessage, mode = 'inbound', correctionHint } = body as {
      nicheId: string
      variables: SdrVariables
      history: SimMessage[]
      userMessage: string
      mode?: 'inbound' | 'outbound'
      correctionHint?: string | null
    }

    const niche = NICHE_MAP[nicheId]
    if (!niche) return NextResponse.json({ error: 'Nicho inválido' }, { status: 400 })
    if (!userMessage?.trim()) return NextResponse.json({ error: 'Mensagem vazia' }, { status: 400 })

    const platformConfig = await getPlatformConfig()
    const openaiKey = platformConfig?.openai_api_key
    if (!openaiKey) {
      return NextResponse.json(
        { error: 'Chave OpenAI não configurada. Vá em Admin → Configurações de Plataforma.' },
        { status: 422 }
      )
    }

    const { default: OpenAI } = await import('openai')
    const openai = new OpenAI({ apiKey: openaiKey })

    const basePrompt = interpolate(niche.conhecimento, variables)
    const modeInstruction = mode === 'outbound'
      ? '\n\n=== MODO OUTBOUND ===\nVocê está abordando ativamente o lead — ele não chegou até você. Seja mais direto na apresentação do valor antes de fazer perguntas. Contextualize por que está entrando em contato.'
      : ''
    const correctionInstruction = correctionHint
      ? `\n\nCORREÇÃO OBRIGATÓRIA: Na resposta anterior você cometeu este erro — "${correctionHint}". Corrija isso agora sem mencionar que está corrigindo.`
      : ''
    const systemPrompt = basePrompt + modeInstruction + correctionInstruction

    // ── Gera resposta do SDR ───────────────────────────────────────────────
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...history.map((m) => ({ role: m.role, content: m.content }) as OpenAI.ChatCompletionMessageParam),
      { role: 'user', content: userMessage },
    ]

    const sdrRes = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages,
      temperature: 0.4,
      max_tokens: 400,
    })

    const sdrResponse = sdrRes.choices[0]?.message?.content?.trim() ?? ''

    // ── Gera feedback da IA ───────────────────────────────────────────────
    const feedbackPrompt = `Você é um especialista em SDR e vendas consultivas pelo WhatsApp.
Avalie APENAS esta resposta específica do agente — o que ele fez NESTA mensagem.

Nicho: ${niche.label}
Modo: ${mode === 'inbound' ? 'Inbound' : 'Outbound'}
Mensagem do lead: "${userMessage}"
Resposta do agente: "${sdrResponse}"

REGRAS ESTRITAS DE AVALIAÇÃO:
1. Avalie SOMENTE o que o agente fez nesta resposta — não antecipe próximos passos
2. Não penalize o agente por não ter feito algo que ainda não era necessário neste momento
3. "melhorar" deve ser null se a resposta está correta e adequada para este momento da conversa
4. Só preencha "melhorar" se houver um erro concreto e específico NESTA resposta (gênero errado, tom inadequado, informação incorreta, pergunta fechada quando deveria ser aberta, etc.)
5. Não diga "poderia ter feito X" — só aponte erros reais que ocorreram

Responda em JSON:
{
  "score": <1 a 10>,
  "positivo": "<o que o agente fez bem nesta mensagem — 1 frase curta>",
  "melhorar": "<erro concreto e específico nesta mensagem — 1 frase curta — ou null se não há erro>"
}`

    const feedbackRes = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [{ role: 'user', content: feedbackPrompt }],
      temperature: 0.2,
      max_tokens: 200,
      response_format: { type: 'json_object' },
    })

    let feedback: { score: number; positivo: string; melhorar: string | null } = {
      score: 0, positivo: '', melhorar: null,
    }
    try {
      const raw = feedbackRes.choices[0]?.message?.content ?? '{}'
      feedback = JSON.parse(raw)
    } catch {}

    return NextResponse.json({ sdrResponse, feedback })
  } catch (err: any) {
    console.error('[sdr/simulate]', err)
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}
