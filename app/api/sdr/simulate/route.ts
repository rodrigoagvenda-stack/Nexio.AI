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
    const { nicheId, variables, history, userMessage } = body as {
      nicheId: string
      variables: SdrVariables
      history: SimMessage[]
      userMessage: string
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

    const systemPrompt = interpolate(niche.conhecimento, variables)

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
Avalie a resposta do agente abaixo de forma objetiva e curta.

Contexto do nicho: ${niche.label}
Mensagem do lead: "${userMessage}"
Resposta do agente: "${sdrResponse}"

Responda em JSON com este formato exato:
{
  "score": <número de 1 a 10>,
  "positivo": "<o que o agente fez bem — máx 1 frase curta>",
  "melhorar": "<o que poderia ser melhor — máx 1 frase curta, ou null se score >= 8>"
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
