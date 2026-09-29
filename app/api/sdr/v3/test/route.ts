import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { rateLimit } from '@/lib/rate-limit'
import { resolveOpenAIKey } from '@/lib/sdr/rag'
import { validateCompanyConfig } from '@/lib/sdr/v3/config-validate'
import { turno } from '@/lib/sdr/v3/self-test-live'
import { ESTADO_INICIAL, type Estado } from '@/lib/sdr/v3/types'
import type { CompanyConfig } from '@/lib/sdr/v3/config-types'

export const runtime = 'nodejs'
export const maxDuration = 60

const schema = z.object({
  config: z.unknown(),
  state: z.unknown().optional(),
  leadText: z.string().max(2000),
  historico: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(4000) })).max(40).optional().default([]),
})

// Testa a conversa do SDR v3 com a config em edição (extrator + decisor + redator + validador em memória,
// como turn.ts faria): não cria lead, não toca em sdr_conversation_state/sdr_turn_log, não manda WhatsApp.
// Passos que dependem de integração real (agendar, oferecer horários, cancelar, gerar cobrança) rodam a
// escrita normalmente, mas viram um aviso porque a ação de verdade (Calendar/Asaas) não acontece aqui.
export async function POST(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request)
  if (authError) return authError

  const rl = rateLimit({ key: `sdr:v3-test:${context.companyId}`, limit: 120, windowMs: 60 * 60_000 })
  if (!rl.success) return NextResponse.json({ success: false, message: 'Limite de testes atingido. Tente novamente em 1 hora.' }, { status: 429 })

  const parsed = schema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ success: false, message: 'Pedido inválido.' }, { status: 422 })
  const { config: rawConfig, state: rawState, leadText, historico } = parsed.data
  if (!leadText.trim()) return NextResponse.json({ success: false, message: 'Escreva a mensagem do lead.' }, { status: 400 })

  const { erros } = validateCompanyConfig(rawConfig)
  if (erros.length > 0) return NextResponse.json({ success: false, message: erros[0], errors: erros }, { status: 400 })
  const config = rawConfig as CompanyConfig

  const state: Estado =
    rawState && typeof rawState === 'object' && Number.isInteger((rawState as Estado).turno) ? (rawState as Estado) : ESTADO_INICIAL(config.version)

  let openai: InstanceType<typeof import('openai').default>
  try {
    const { default: OpenAI } = await import('openai')
    openai = new OpenAI({ apiKey: await resolveOpenAIKey(context.companyId) })
  } catch {
    return NextResponse.json({ success: false, message: 'A leitura de mensagens não está disponível agora. Fale com o suporte.' }, { status: 422 })
  }

  const r = await turno(openai, config, state, historico, leadText, {})

  const notes: string[] = []
  if (r.acao.handoff) notes.push('A conversa passa para uma pessoa da equipe.')
  if (r.acao.tipo === 'oferecer_horarios') notes.push('Aqui o agente ofereceria os horários da agenda. O teste não simula a agenda real.')
  if (r.acao.tipo === 'agendar') notes.push('Aqui o agente agendaria de verdade. O teste não simula o agendamento.')
  if (r.acao.tipo === 'cancelar_reuniao') notes.push('Aqui o agente cancelaria a reunião de verdade. O teste não simula isso.')
  if (r.acao.tipo === 'gerar_cobranca') notes.push('Aqui o agente geraria uma cobrança real. O teste não simula isso.')

  return NextResponse.json({ success: true, messages: r.blocos, notes, state: r.estado })
}
