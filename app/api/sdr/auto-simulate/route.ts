import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NICHE_MAP, interpolate, type SdrVariables } from '@/lib/sdr/templates'
import { getPlatformConfig } from '@/lib/platform-config'
import type OpenAI from 'openai'

export const runtime = 'nodejs'
export const maxDuration = 120

export const LEAD_PERSONA_PROMPTS: Record<string, string> = {
  cold: `Você é um lead FRIO no WhatsApp. Chegou por curiosidade, sem urgência real.
Comportamento: respostas curtas no início, cético com promessas, pode se abrir se o agente mostrar valor real.
Nunca demonstre pressa. Use "como funciona?" mais do que "quanto custa?".`,

  price: `Você é um lead que foca em PREÇO acima de tudo no WhatsApp.
Comportamento: primeira mensagem pergunta o valor, compara com concorrentes, usa "tá caro" e "achei mais barato".
Só avança se o agente mostrar valor concreto que justifique o preço.`,

  urgent: `Você é um lead URGENTE no WhatsApp. Precisa resolver hoje ou amanhã.
Comportamento: respostas rápidas, pouca paciência para qualificação longa, quer saber disponibilidade imediata.
Se o agente enrolar, você desiste. Se for direto, converte rápido.`,

  indecisive: `Você é um lead INDECISO no WhatsApp. Pesquisou muito, conhece bem o produto.
Comportamento: usa "vou pensar", "deixa eu ver", "não sei ainda". Tem medo de decidir errado.
Precisa de garantias e segurança. Converte com paciência e argumentos sólidos.`,

  closing: `Você é um lead QUASE FECHANDO no WhatsApp. Já decidiu que quer, só precisa de detalhes finais.
Comportamento: perguntas pontuais e diretas, responde bem a CTAs, quer confirmar logística.
Converte facilmente se o agente não complicar.`,
}

async function buildSdrPrompt(
  openai: OpenAI,
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  nicheId: string,
  variables: SdrVariables,
  flowId?: string | null,
  user?: { id: string } | null
): Promise<string> {
  const niche = NICHE_MAP[nicheId]
  let prompt = interpolate(niche.conhecimento, variables)

  if (flowId && user) {
    const service = createServiceClient()
    const { data: userData } = await (supabase as any)
      .from('users').select('company_id').eq('auth_user_id', user.id).single()
    if (userData?.company_id) {
      const { data: docs } = await service
        .from('documents')
        .select('content, metadata')
        .eq('company_id', userData.company_id)
        .contains('metadata', { flow_id: flowId, doc_type: 'conhecimento' })
        .order('created_at', { ascending: true })

      const real = docs?.filter((d) => !d.metadata?.is_correction) ?? []
      const corrections = docs?.filter((d) => d.metadata?.is_correction) ?? []

      if (real.length > 0) prompt = real.map((d) => d.content).join('\n\n')
      if (corrections.length > 0) {
        prompt += '\n\n=== CORREÇÕES OBRIGATÓRIAS ===\n' + corrections.map((d) => d.content).join('\n\n')
      }
    }
  }

  return prompt
}

async function leadRespond(
  openai: OpenAI,
  leadSystemPrompt: string,
  history: OpenAI.ChatCompletionMessageParam[],
  isFirst: boolean
): Promise<string> {
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: leadSystemPrompt },
    ...history,
    { role: 'user', content: isFirst ? 'Envie sua primeira mensagem para o atendente.' : 'Continue a conversa como lead.' },
  ]
  const res = await openai.chat.completions.create({
    model: 'gpt-4.1-mini', messages, temperature: 0.8, max_tokens: 80,
    response_format: { type: 'json_object' },
  })
  try { return JSON.parse(res.choices[0]?.message?.content ?? '{}').message ?? 'Ok.' } catch { return 'Ok.' }
}

async function sdrRespond(
  openai: OpenAI,
  sdrSystemPrompt: string,
  history: OpenAI.ChatCompletionMessageParam[],
  leadMsg: string,
  mode: string
): Promise<string[]> {
  const modeNote = mode === 'outbound' ? '\n\n=== MODO OUTBOUND ===' : ''
  const fmt = '\n\nFORMATO OBRIGATÓRIO: {"messages": ["msg1", "msg2"]}\nMáximo 3 linhas por mensagem.'
  const res = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [
      { role: 'system', content: sdrSystemPrompt + modeNote + fmt },
      ...history,
      { role: 'user', content: leadMsg },
    ],
    temperature: 0.4, max_tokens: 400,
    response_format: { type: 'json_object' },
  })
  try {
    const p = JSON.parse(res.choices[0]?.message?.content ?? '{}')
    return Array.isArray(p.messages) ? p.messages.map(String).filter(Boolean) : [p.message ?? '...']
  } catch { return ['...'] }
}

async function evalTurn(
  openai: OpenAI, nicheLabel: string, mode: string, leadMsg: string, sdrMsg: string
): Promise<{ score: number; positivo: string; melhorar: string | null }> {
  const res = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [{
      role: 'user',
      content: `Nicho: ${nicheLabel} | ${mode === 'inbound' ? 'Inbound' : 'Outbound'}
Lead: "${leadMsg}"
Agente: "${sdrMsg}"
Avalie só esta resposta.
JSON: {"score": 1-10, "positivo": "1 frase", "melhorar": "1 frase ou null se correto"}`,
    }],
    temperature: 0.2, max_tokens: 150,
    response_format: { type: 'json_object' },
  })
  try { return JSON.parse(res.choices[0]?.message?.content ?? '{}') }
  catch { return { score: 0, positivo: '', melhorar: null } }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const body = await request.json()
    const { nicheId, variables, flowId, mode = 'inbound', persona = 'cold', rounds = 4 } = body as {
      nicheId: string; variables: SdrVariables; flowId?: string | null
      mode?: 'inbound' | 'outbound'; persona?: string; rounds?: number
    }

    const niche = NICHE_MAP[nicheId]
    if (!niche) return NextResponse.json({ error: 'Nicho inválido' }, { status: 400 })

    const platformConfig = await getPlatformConfig()
    const openaiKey = platformConfig?.openai_api_key
    if (!openaiKey) return NextResponse.json({ error: 'Chave OpenAI não configurada.' }, { status: 422 })

    const { default: OpenAI } = await import('openai')
    const openai = new OpenAI({ apiKey: openaiKey })

    const sdrPrompt = await buildSdrPrompt(openai as any, supabase as any, nicheId, variables, flowId, user)

    const personaBase = LEAD_PERSONA_PROMPTS[persona] ?? LEAD_PERSONA_PROMPTS.cold
    const leadSystemPrompt = `${personaBase}

Negócio: ${variables.nome_empresa ?? 'empresa'} — ${niche.label}
Responda APENAS em JSON: {"message": "sua mensagem"}`

    type AutoTurn = {
      userMsg: string; sdrMsgs: string[]
      feedback: { score: number; positivo: string; melhorar: string | null }
      ts: string; isAuto: true
    }
    const turns: AutoTurn[] = []
    const convHistory: OpenAI.ChatCompletionMessageParam[] = []
    const maxRounds = Math.min(Math.max(rounds, 2), 6)

    for (let round = 0; round < maxRounds; round++) {
      const leadMsg = await leadRespond(openai, leadSystemPrompt, convHistory, round === 0)
      const sdrMsgs = await sdrRespond(openai, sdrPrompt, convHistory, leadMsg, mode)
      const sdrText = sdrMsgs.filter((m) => !m.match(/^\[(FOTO|AUDIO|PDF:)/)).join('\n')
      const feedback = await evalTurn(openai, niche.label, mode, leadMsg, sdrText)

      const ts = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      turns.push({ userMsg: leadMsg, sdrMsgs, feedback, ts, isAuto: true })

      convHistory.push({ role: 'user', content: leadMsg })
      convHistory.push({ role: 'assistant', content: sdrText })

      // Stop early if lead clearly converted
      if (round >= 2 && feedback.score >= 9) break
    }

    const avgScore = turns.length
      ? Math.round(turns.reduce((s, t) => s + t.feedback.score, 0) / turns.length)
      : 0
    const errors = turns.filter((t) => t.feedback.melhorar).map((t) => t.feedback.melhorar!)
    const wouldConvert = avgScore >= 7

    return NextResponse.json({ turns, summary: { avgScore, wouldConvert, errors, rounds: turns.length } })
  } catch (err: any) {
    console.error('[auto-simulate]', err)
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}
