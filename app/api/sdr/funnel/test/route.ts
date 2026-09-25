import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getPlatformConfig } from '@/lib/platform-config'
import { rateLimit } from '@/lib/rate-limit'
import { validateFunnelConfig } from '@/lib/sdr/funnel/validate'
import { readMessage } from '@/lib/sdr/funnel/reader'
import { splitOpening, stepFunnel } from '@/lib/sdr/funnel/machine'
import { initialState, type FunnelConfig, type FunnelState } from '@/lib/sdr/funnel/types'

export const runtime = 'nodejs'
export const maxDuration = 60

const schema = z.object({
  config: z.unknown(),
  state: z.unknown().optional(),
  leadText: z.string().max(2000).optional().default(''),
  transcript: z.array(z.string().max(2000)).max(40).optional().default([]),
})

// Testa o roteiro do funil com a versão em edição, sem gravar nada e sem enviar nada a ninguém.
// O motor é o mesmo do atendimento real (leitor + máquina de estados); o que a IA escreve por conta própria
// (conversa livre, reescrita, resposta da base) não entra aqui: o teste mostra o texto aprovado.
export async function POST(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request)
  if (authError) return authError

  const rl = rateLimit({ key: `sdr:funnel-test:${context.companyId}`, limit: 120, windowMs: 60 * 60_000 })
  if (!rl.success) return NextResponse.json({ success: false, message: 'Limite de testes atingido. Tente novamente em 1 hora.' }, { status: 429 })

  const parsed = schema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ success: false, message: 'Pedido inválido.' }, { status: 422 })
  const { config: rawConfig, state: rawState, leadText, transcript } = parsed.data

  const errors = validateFunnelConfig(rawConfig)
  if (errors.length > 0) return NextResponse.json({ success: false, message: errors[0], errors }, { status: 400 })
  const config = rawConfig as FunnelConfig

  const state: FunnelState = rawState && typeof rawState === 'object' && (rawState as FunnelState).v === 1 ? (rawState as FunnelState) : initialState()
  const isFirstTurn = state.turns === 0 && !leadText.trim()

  // Primeira mensagem do agente: a pergunta 1 do roteiro, como o lead a recebe
  if (isFirstTurn) {
    const first = config.steps[0]
    const { intro, question } = splitOpening(first.question.replace(/\{nome\}/gi, ''))
    return NextResponse.json({ success: true, messages: [intro, question].filter((t): t is string => !!t), notes: [], state: { ...state, askedStep: first.id, turns: 1 } })
  }
  if (!leadText.trim()) return NextResponse.json({ success: false, message: 'Escreva a mensagem do lead.' }, { status: 400 })

  const platformConfig = await getPlatformConfig()
  const openaiKey = platformConfig?.openai_api_key
  if (!openaiKey) return NextResponse.json({ success: false, message: 'A leitura de mensagens não está disponível agora. Fale com o suporte.' }, { status: 422 })
  const { default: OpenAI } = await import('openai')
  const openai = new OpenAI({ apiKey: openaiKey })

  const reading = await readMessage({ config, state, leadText, transcript, isFirstTurn: false }, openai)
  let result = stepFunnel(config, state, reading, { isFirstTurn: false, leadText })
  // A base de conhecimento não entra no teste: sem resposta na base, o funil usa o texto de "não sei" aprovado
  if (result.needBox) result = stepFunnel(config, state, reading, { isFirstTurn: false, leadText, boxAnswer: null })

  const messages: string[] = []
  const notes: string[] = []
  for (const a of result.actions) {
    if (a.type === 'send') messages.push(...a.texts)
    else if (a.type === 'handoff') { messages.push(...a.texts); notes.push('A conversa passa para uma pessoa da equipe.') }
    else if (a.type === 'converse') notes.push('Aqui o agente conversa livremente com base no que sabe. O teste não simula esse trecho.')
    else if (a.type === 'delegate_scheduling') notes.push('Aqui o agente oferece os horários da agenda. O teste não simula o agendamento.')
    else if (a.type === 'mark_refused') notes.push('O lead é marcado como sem interesse.')
    else if (a.type === 'silence') notes.push('O agente fica em silêncio neste ponto.')
    else if (a.type === 'notify') notes.push('A equipe é avisada.')
  }

  return NextResponse.json({ success: true, messages: messages.map((t) => t.replace(/\{nome\}/gi, result.state.data.nome ?? '')), notes, state: result.state })
}
