import { NextRequest } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NICHE_MAP, interpolate, type SdrVariables } from '@/lib/sdr/templates'
import { getPlatformConfig } from '@/lib/platform-config'
import { rateLimit } from '@/lib/rate-limit'
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
  const fmt = '\n\nFORMATO OBRIGATÓRIO — responda em JSON assim: {"messages": ["msg1", "msg2"]}\nMáximo 3 linhas por mensagem.'
  const allMessages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: sdrSystemPrompt + modeNote + fmt },
    ...history,
    { role: 'user', content: leadMsg },
  ]
  const hasJson = allMessages.some((m) => typeof m.content === 'string' && m.content.toLowerCase().includes('json'))
  const res = await openai.chat.completions.create({
    model: 'gpt-4.1',
    messages: allMessages,
    temperature: 0.4, max_tokens: 600,
    ...(hasJson ? { response_format: { type: 'json_object' as const } } : {}),
  })
  try {
    const raw = res.choices[0]?.message?.content ?? '{}'
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    const p = JSON.parse(jsonMatch ? jsonMatch[0] : raw)
    return Array.isArray(p.messages) ? p.messages.map(String).filter(Boolean) : [p.message ?? '...']
  } catch { return ['...'] }
}

async function evalTurn(
  openai: OpenAI, nicheLabel: string, mode: string, leadMsg: string, sdrMsg: string
): Promise<{ score: number; positivo: string; melhorar: string | null }> {
  const res = await openai.chat.completions.create({
    model: 'gpt-4.1',
    messages: [{
      role: 'user',
      content: `Nicho: ${nicheLabel} | ${mode === 'inbound' ? 'Inbound' : 'Outbound'}
Lead: "${leadMsg}"
Agente: "${sdrMsg}"

REGRAS ESTRITAS:
1. Avalie SOMENTE o que o agente fez nesta resposta
2. "melhorar" deve ser null se a resposta está correta e adequada para este momento
3. Só preencha "melhorar" se houver erro concreto e específico (gênero errado, tom inadequado, informação incorreta, pergunta fechada quando deveria ser aberta)
4. Não diga "poderia ter feito X" — só aponte erros reais que ocorreram

Responda em JSON: {"score": 1-10, "positivo": "1 frase", "melhorar": "1 frase com erro real ou null"}`,
    }],
    temperature: 0.1, max_tokens: 200,
    response_format: { type: 'json_object' },
  })
  try { return JSON.parse(res.choices[0]?.message?.content ?? '{}') }
  catch { return { score: 0, positivo: '', melhorar: null } }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401 })
  }

  const rl = rateLimit({ key: `sdr:auto-simulate:${user.id}`, limit: 10, windowMs: 60 * 60_000 })
  if (!rl.success) {
    return new Response(JSON.stringify({ error: 'Limite de auto-simulações atingido. Tente novamente em 1 hora.' }), { status: 429 })
  }

  const body = await request.json()
  const { nicheId, variables, flowId, mode = 'inbound', persona = 'cold', rounds = 4 } = body as {
    nicheId: string; variables: SdrVariables; flowId?: string | null
    mode?: 'inbound' | 'outbound'; persona?: string; rounds?: number
  }

  const niche = NICHE_MAP[nicheId]
  if (!niche) return new Response(JSON.stringify({ error: 'Nicho inválido' }), { status: 400 })

  const platformConfig = await getPlatformConfig()
  const openaiKey = platformConfig?.openai_api_key
  if (!openaiKey) return new Response(JSON.stringify({ error: 'Chave OpenAI não configurada.' }), { status: 422 })

  const { default: OpenAI } = await import('openai')
  const openai = new OpenAI({ apiKey: openaiKey })

  const sdrPrompt = await buildSdrPrompt(supabase as any, nicheId, variables, flowId, user)

  const personaBase = LEAD_PERSONA_PROMPTS[persona] ?? LEAD_PERSONA_PROMPTS.cold
  const leadSystemPrompt = `${personaBase}

Negócio: ${variables.nome_empresa ?? 'empresa'} — ${niche.label}
Responda APENAS em JSON: {"message": "sua mensagem"}`

  const maxRounds = Math.min(Math.max(rounds, 2), 6)
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)) } catch {}
      }

      try {
        type TurnAcc = { leadMsg: string; sdrText: string; feedback: { score: number; positivo: string; melhorar: string | null } }
        const allTurns: TurnAcc[] = []
        const convHistory: OpenAI.ChatCompletionMessageParam[] = []

        for (let round = 0; round < maxRounds; round++) {
          const leadMsg = await leadRespond(openai, leadSystemPrompt, convHistory, round === 0)
          send({ type: 'lead', message: leadMsg, round })

          const sdrMsgs = await sdrRespond(openai, sdrPrompt, convHistory, leadMsg, mode)
          send({ type: 'sdr', messages: sdrMsgs, round })

          const sdrText = sdrMsgs.filter((m) => !m.match(/^\[(FOTO|AUDIO|PDF:)/)).join('\n')
          const feedback = await evalTurn(openai, niche.label, mode, leadMsg, sdrText)
          send({ type: 'feedback', feedback, round })

          allTurns.push({ leadMsg, sdrText, feedback })
          convHistory.push({ role: 'user', content: leadMsg })
          convHistory.push({ role: 'assistant', content: sdrText })

          if (round >= 2 && feedback.score >= 9) break
        }

        const avgScore = allTurns.length
          ? Math.round(allTurns.reduce((s, t) => s + t.feedback.score, 0) / allTurns.length)
          : 0
        const errors = allTurns.filter((t) => t.feedback.melhorar).map((t) => t.feedback.melhorar!)
        const wouldConvert = avgScore >= 7

        send({ type: 'summary', summary: { avgScore, wouldConvert, errors, rounds: allTurns.length } })
      } catch (err: any) {
        console.error('[auto-simulate]', err)
        send({ type: 'error', message: err.message || 'Erro interno' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
