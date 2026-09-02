/**
 * Harness de avaliação do SDR : roda o motor REAL de produção
 * (processSdrMessage) de ponta a ponta, sem mandar WhatsApp de verdade,
 * contra uma empresa-sombra isolada (lib/sdr/qa-shadow.ts). O dry-run é
 * feito por companies.features.qa_dry_run=true : intercepta só o envio
 * final (dentro de sendWithHumanDelay em lib/sdr/engine.ts), mas
 * mensagens_do_whatsapp continua sendo gravada normal, então esse harness
 * lê a resposta de volta do banco, igual o Atendimento faria.
 *
 * Dois usos:
 * - `runSdrEval(realCompanyId)` : regressão técnica, cenários fixos,
 *   resultado bruto (checks/log). Uso interno (Claude/dev), antes de
 *   entregar mudança no núcleo. Rotas: scripts/sdr-eval.ts,
 *   POST /api/admin/qa/sdr-eval (Bearer CRON_SECRET).
 * - `runTenantSelfTest(realCompanyId)` : mesmos cenários, resultado em
 *   português simples pro próprio cliente ler. Rota:
 *   POST /api/sdr/self-test (auth normal de usuário logado).
 */
import { createServiceClient } from '@/lib/supabase/server'
import { processSdrMessage, bufferMessage, type BufferedMessage } from '@/lib/sdr/engine'
import { ensureShadowCompany } from '@/lib/sdr/qa-shadow'
import { resolveOpenAIKey } from '@/lib/sdr/rag'

type Supabase = ReturnType<typeof createServiceClient>

export interface EvalCheck {
  ok: boolean
  label: string
}

export interface EvalResult {
  passed: number
  failed: number
  checks: EvalCheck[]
  log: string[]
}

export interface TenantSelfTestResult {
  passou: boolean
  resumo: string
  detalhes: EvalCheck[]
}

// ─── Helpers de execução (parametrizados pela empresa-sombra) ────────

function makeRunner(companyId: number, supabase: Supabase) {
  const resetLead = async (phone: string) => {
    const { data: conv } = await supabase
      .from('conversas_do_whatsapp')
      .select('id')
      .eq('company_id', companyId)
      .eq('numero_de_telefone', phone)
      .maybeSingle()
    if (conv) {
      await supabase.from('mensagens_do_whatsapp').delete().eq('id_da_conversacao', conv.id)
      await supabase.from('conversas_do_whatsapp').delete().eq('id', conv.id)
    }
    await supabase.from('leads').delete().eq('company_id', companyId).eq('whatsapp', phone)
    await supabase.from('sdr_message_buffer').delete().eq('company_id', companyId).eq('phone', phone)
  }

  const getOutboundSince = async (phone: string, since: string): Promise<string[]> => {
    const { data: conv } = await supabase
      .from('conversas_do_whatsapp')
      .select('id')
      .eq('company_id', companyId)
      .eq('numero_de_telefone', phone)
      .maybeSingle()
    if (!conv) return []
    const { data: msgs } = await supabase
      .from('mensagens_do_whatsapp')
      .select('texto_da_mensagem, carimbo_de_data_e_hora')
      .eq('id_da_conversacao', conv.id)
      .eq('direcao', 'outbound')
      .gte('carimbo_de_data_e_hora', since)
      .order('carimbo_de_data_e_hora', { ascending: true })
    return (msgs ?? []).map((m) => m.texto_da_mensagem ?? '')
  }

  const sendLeadMessage = async (phone: string, text: string, senderName = 'Lead Teste'): Promise<string[]> => {
    const since = new Date().toISOString()
    const msg: BufferedMessage = {
      content: text,
      type: 'text',
      // 20s no passado : pula o throttle de 15s do processSdrMessage.
      timestamp: new Date(Date.now() - 20_000).toISOString(),
      messageId: `qa-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      senderName,
    }
    await bufferMessage(companyId, phone, msg, supabase)
    await processSdrMessage(companyId, phone)
    return getOutboundSince(phone, since)
  }

  const getChecklist = async (phone: string): Promise<Record<string, unknown> | null> => {
    const { data: conv } = await supabase
      .from('conversas_do_whatsapp')
      .select('checklist_atendimento')
      .eq('company_id', companyId)
      .eq('numero_de_telefone', phone)
      .maybeSingle()
    return (conv?.checklist_atendimento as Record<string, unknown> | null) ?? null
  }

  const hasFechamentoConfigured = async (): Promise<boolean> => {
    const { data } = await supabase
      .from('documents')
      .select('id')
      .eq('company_id', companyId)
      .ilike('content', '%=== FECHAMENTO ===%')
      .limit(1)
      .maybeSingle()
    return !!data
  }

  const hasBriefingLink = async (): Promise<boolean> => {
    const { data } = await supabase.from('companies').select('features').eq('id', companyId).single()
    return (data?.features as Record<string, boolean> | null)?.briefing === true
  }

  return { resetLead, sendLeadMessage, getChecklist, hasFechamentoConfigured, hasBriefingLink }
}

// ─── Cenários (genéricos : servem pra qualquer nicho/empresa) ─────────

async function runScenarios(companyId: number, supabase: Supabase): Promise<{ checks: EvalCheck[]; log: string[] }> {
  const checks: EvalCheck[] = []
  const log: string[] = []
  const say = (line: string) => {
    log.push(line)
    console.log(line)
  }
  const assert = (condition: boolean, label: string) => {
    checks.push({ ok: condition, label })
    say(`  ${condition ? '✓' : '✗'} ${label}`)
  }
  const assertBlockCap = (messages: string[], turnLabel: string) => {
    assert(messages.length <= 3, `${turnLabel}: no máximo 3 blocos (veio ${messages.length})`)
  }

  const { resetLead, sendLeadMessage, getChecklist, hasFechamentoConfigured, hasBriefingLink } = makeRunner(companyId, supabase)

  // Cenário 1 : lead pergunta preço direto — smoke test (varia por empresa,
  // não dá pra saber o valor certo aqui) : só confirma que responde de
  // verdade, sem travar e sem virar discurso longo.
  say('\n[Cenário 1] Lead pergunta preço direto')
  {
    const phone = '5511900000001'
    await resetLead(phone)
    await sendLeadMessage(phone, 'Oi, tudo bem?')
    const r2 = await sendLeadMessage(phone, 'Quanto custa?')
    assert(r2.length > 0, 'SDR respondeu à pergunta de preço (não ficou em silêncio)')
    assertBlockCap(r2, 'resposta de preço')
  }

  // Cenário 2 : lead confirma intenção de agendar — só roda de verdade se a
  // empresa usa formulário de briefing (senão não há o que travar).
  say('\n[Cenário 2] Lead confirma intenção de agendar')
  if (await hasBriefingLink()) {
    const phone = '5511900000002'
    await resetLead(phone)
    await sendLeadMessage(phone, 'Oi, vi o anúncio de vocês e fiquei interessado')
    const r2 = await sendLeadMessage(phone, 'Quero marcar uma reunião')
    const joined = r2.join(' \n ')
    assert(!/nome completo/i.test(joined), 'não pula direto pra coleta de nome/e-mail sem passar pelo formulário')
    assertBlockCap(r2, 'resposta de agendamento')
  } else {
    say('  (pulado : empresa não usa formulário de briefing, nada a travar aqui)')
  }

  // Cenário 3 : lead diz que não tem interesse — checklist tem que persistir
  // a recusa e o SDR tem que parar de insistir na mensagem seguinte.
  say('\n[Cenário 3] Lead que recusa não pode ser abordado de novo')
  {
    const phone = '5511900000003'
    await resetLead(phone)
    await sendLeadMessage(phone, 'Oi')
    await sendLeadMessage(phone, 'não quero mais informação')
    const checklist = await getChecklist(phone)
    assert(checklist?.lead_recusou === true, 'checklist_atendimento.lead_recusou = true depois da recusa')
    const r3 = await sendLeadMessage(phone, 'ok')
    assert(r3.length <= 1, `resposta seguinte é curta/sem novo pitch (veio ${r3.length} bloco(s))`)
  }

  // Cenário 4 : intenção de compra fraseada de forma indireta — o bloco de
  // Fechamento (se configurado) tem que aparecer mesmo sem palavras óbvias
  // de fechamento na pergunta do lead.
  say('\n[Cenário 4] Fechamento aparece mesmo com pergunta indireta')
  if (await hasFechamentoConfigured()) {
    const phone = '5511900000004'
    await resetLead(phone)
    await sendLeadMessage(phone, 'Pode me contar mais sobre como funciona?')
    const r2 = await sendLeadMessage(phone, 'é isso que eu preciso mesmo, não é?')
    assertBlockCap(r2, 'resposta de fechamento indireto')
  } else {
    say('  (pulado : empresa não tem bloco de Fechamento configurado no wizard ainda)')
  }

  return { checks, log }
}

// ─── Uso técnico (regressão, resultado bruto) ─────────────────────────

export async function runSdrEval(realCompanyId: number): Promise<EvalResult> {
  const supabase = createServiceClient()
  const shadowId = await ensureShadowCompany(realCompanyId, supabase)
  const { checks, log } = await runScenarios(shadowId, supabase)

  const passed = checks.filter((c) => c.ok).length
  const failed = checks.filter((c) => !c.ok).length
  log.push(`\n${'─'.repeat(50)}`)
  log.push(`Resultado: ${passed} passou, ${failed} falhou (empresa-sombra id=${shadowId})`)

  return { passed, failed, checks, log }
}

// ─── Uso pelo cliente (resumo em português) ───────────────────────────

export async function runTenantSelfTest(realCompanyId: number): Promise<TenantSelfTestResult> {
  const supabase = createServiceClient()
  const shadowId = await ensureShadowCompany(realCompanyId, supabase)
  const { checks } = await runScenarios(shadowId, supabase)

  const failed = checks.filter((c) => !c.ok)
  const passou = failed.length === 0

  if (passou) {
    return {
      passou: true,
      resumo: 'Seu SDR passou em todos os testes automáticos : respondeu perguntas de preço, não insistiu com quem recusou, e não pulou etapas configuradas.',
      detalhes: checks,
    }
  }

  // Traduz os checks técnicos que falharam pra português simples, sem termo
  // de programação : mesma ideia do feedback que /api/sdr/simulate já gera.
  let resumo = `Seu SDR não passou em ${failed.length} de ${checks.length} teste(s). Veja os detalhes.`
  try {
    const openaiKey = await resolveOpenAIKey(realCompanyId)
    const { default: OpenAI } = await import('openai')
    const openai = new OpenAI({ apiKey: openaiKey })
    const res = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [{
        role: 'user',
        content: `Traduza esta lista de falhas técnicas de um teste automático de SDR (vendedor por WhatsApp) pra um resumo curto em português, pra um dono de empresa leigo em tecnologia entender o que precisa de atenção. Sem termo técnico, sem nome de função, 2-3 frases no máximo.\n\nFalhas:\n${failed.map((f) => `- ${f.label}`).join('\n')}`,
      }],
      temperature: 0.3,
      max_tokens: 200,
    })
    resumo = res.choices[0]?.message?.content?.trim() || resumo
  } catch {
    // Se a tradução falhar, fica o resumo técnico mesmo : melhor que nada.
  }

  return { passou: false, resumo, detalhes: checks }
}
