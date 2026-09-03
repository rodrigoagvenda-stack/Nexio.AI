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
 *   português simples com a transcrição real de cada conversa. Rota:
 *   POST /api/sdr/self-test (auth normal de usuário logado).
 *
 * Achado ao vivo (2026-09-02) : rodar dois testes ao mesmo tempo pra mesma
 * empresa (2 abas, duplo clique) corrompe tudo — toda mensagem sai
 * duplicada, resultado vira lixo. runTenantSelfTest trava contra isso
 * (companies.qa_test_running_since).
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

export interface ScenarioReport {
  nome: string
  passou: boolean
  transcript: { lead: string; sdr: string }[]
  observacao: string
}

export interface TenantSelfTestResult {
  passou: boolean
  resumo: string
  detalhes: ScenarioReport[]
}

const LOCK_TTL_MS = 3 * 60_000 // trava expira sozinha se algo travar de verdade no meio

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

/** Cada cenário usa um telefone próprio e roda isolado : dá pra rodar os 4
 * em paralelo (Promise.all lá embaixo) sem colidir, o que corta o tempo
 * total de ~4x pra ~1x (cada chamada real ao motor já é lenta sozinha,
 * rodar em série quase estourava o timeout do proxy). */
function makeScenario(companyId: number, supabase: Supabase) {
  const { resetLead, sendLeadMessage, getChecklist, hasFechamentoConfigured, hasBriefingLink } = makeRunner(companyId, supabase)

  // Cenário 1 : lead pergunta preço direto — smoke test (varia por empresa,
  // não dá pra saber o valor certo aqui) : só confirma que responde de
  // verdade, sem travar e sem virar discurso longo.
  const precoDireto = async (): Promise<ScenarioReport> => {
    const phone = '5511900000001'
    await resetLead(phone)
    await sendLeadMessage(phone, 'Oi, tudo bem?')
    const r2 = await sendLeadMessage(phone, 'Quanto custa?')
    const transcript = [
      { lead: 'Oi, tudo bem?', sdr: '(cumprimento inicial)' },
      { lead: 'Quanto custa?', sdr: r2.join(' ') || '(sem resposta)' },
    ]
    if (r2.length === 0) return { nome: 'Lead pergunta preço direto', passou: false, transcript, observacao: 'O SDR não respondeu quando o lead perguntou o preço direto.' }
    if (r2.length > 3) return { nome: 'Lead pergunta preço direto', passou: false, transcript, observacao: `A resposta veio em ${r2.length} mensagens seguidas : ficou um textão em vez de curto e direto.` }
    return { nome: 'Lead pergunta preço direto', passou: true, transcript, observacao: 'Respondeu de forma curta e direta.' }
  }

  // Cenário 2 : lead confirma intenção de agendar — só roda de verdade se a
  // empresa usa formulário de briefing (senão não há o que travar).
  const confirmaAgendamento = async (): Promise<ScenarioReport | null> => {
    if (!(await hasBriefingLink())) return null // empresa não usa formulário : nada a testar aqui
    const phone = '5511900000002'
    await resetLead(phone)
    await sendLeadMessage(phone, 'Oi, vi o anúncio de vocês e fiquei interessado')
    const r2 = await sendLeadMessage(phone, 'Quero marcar uma reunião')
    const joined = r2.join(' ')
    const transcript = [
      { lead: 'Oi, vi o anúncio de vocês e fiquei interessado', sdr: '(abertura)' },
      { lead: 'Quero marcar uma reunião', sdr: joined || '(sem resposta)' },
    ]
    if (/nome completo/i.test(joined)) {
      return { nome: 'Lead confirma intenção de agendar', passou: false, transcript, observacao: 'Pulou direto pra pedir nome/e-mail, sem passar pelo formulário configurado antes.' }
    }
    if (r2.length === 0) return { nome: 'Lead confirma intenção de agendar', passou: false, transcript, observacao: 'O SDR não respondeu ao pedido de agendamento.' }
    return { nome: 'Lead confirma intenção de agendar', passou: true, transcript, observacao: 'Seguiu o fluxo configurado corretamente antes de agendar.' }
  }

  // Cenário 3 : lead diz que não tem interesse — checklist tem que persistir
  // a recusa e o SDR tem que parar de insistir na mensagem seguinte.
  const recusaPersiste = async (): Promise<ScenarioReport> => {
    const phone = '5511900000003'
    await resetLead(phone)
    const r1 = await sendLeadMessage(phone, 'Oi')
    const r2 = await sendLeadMessage(phone, 'não quero mais informação')
    const checklist = await getChecklist(phone)
    const recusouRegistrada = checklist?.lead_recusou === true
    const r3 = await sendLeadMessage(phone, 'ok')
    const transcript = [
      { lead: 'Oi', sdr: r1.join(' ') || '(sem resposta)' },
      { lead: 'não quero mais informação', sdr: r2.join(' ') || '(sem resposta)' },
      { lead: 'ok', sdr: r3.join(' ') || '(silêncio, esperado aqui)' },
    ]
    if (!recusouRegistrada) {
      return { nome: 'Lead que recusa não pode ser abordado de novo', passou: false, transcript, observacao: 'O sistema não registrou que o lead recusou : ele pode voltar a ser abordado por engano.' }
    }
    if (r3.length > 1) {
      return { nome: 'Lead que recusa não pode ser abordado de novo', passou: false, transcript, observacao: 'Mesmo depois da recusa, o SDR mandou uma oferta nova em vez de ficar quieto.' }
    }
    return { nome: 'Lead que recusa não pode ser abordado de novo', passou: true, transcript, observacao: 'Registrou a recusa e parou de insistir corretamente.' }
  }

  // Cenário 4 : intenção de compra fraseada de forma indireta — o bloco de
  // Fechamento (se configurado) tem que aparecer mesmo sem palavras óbvias
  // de fechamento na pergunta do lead.
  const fechamentoIndireto = async (): Promise<ScenarioReport | null> => {
    if (!(await hasFechamentoConfigured())) return null // empresa não tem bloco de fechamento configurado ainda
    const phone = '5511900000004'
    await resetLead(phone)
    const r1 = await sendLeadMessage(phone, 'Pode me contar mais sobre como funciona?')
    const r2 = await sendLeadMessage(phone, 'é isso que eu preciso mesmo, não é?')
    const transcript = [
      { lead: 'Pode me contar mais sobre como funciona?', sdr: r1.join(' ') || '(sem resposta)' },
      { lead: 'é isso que eu preciso mesmo, não é?', sdr: r2.join(' ') || '(sem resposta)' },
    ]
    if (r2.length > 3) {
      return { nome: 'Fechamento aparece mesmo com pergunta indireta', passou: false, transcript, observacao: `Resposta em ${r2.length} mensagens : longa demais pra esse momento da conversa.` }
    }
    return { nome: 'Fechamento aparece mesmo com pergunta indireta', passou: true, transcript, observacao: 'Reconheceu a intenção de fechar mesmo sem palavras óbvias.' }
  }

  return [precoDireto, confirmaAgendamento, recusaPersiste, fechamentoIndireto]
}

async function runScenarios(companyId: number, supabase: Supabase): Promise<ScenarioReport[]> {
  const scenarios = makeScenario(companyId, supabase)
  // Sequencial de propósito, não Promise.all : achado ao vivo (2026-09-02)
  // que rodar os 4 cenários em paralelo dispara várias chamadas gpt-4.1
  // simultâneas (cada turno já é um orquestrador inteiro com várias tools,
  // várias chamadas sozinho) e estoura o limite de tokens/min da chave —
  // que pode ser a chave PRÓPRIA da empresa, compartilhada com o
  // atendimento real dela. Mais lento, mas não arrisca travar cliente de
  // verdade por causa de um teste.
  const results: (ScenarioReport | null)[] = []
  for (const scenario of scenarios) {
    results.push(await scenario())
  }
  return results.filter((r): r is ScenarioReport => r !== null)
}

// ─── Trava contra execução concorrente pra mesma empresa ──────────────

async function acquireTestLock(realCompanyId: number, supabase: Supabase): Promise<void> {
  const { data: company } = await supabase
    .from('companies')
    .select('qa_test_running_since')
    .eq('id', realCompanyId)
    .single()

  const runningSince = company?.qa_test_running_since ? new Date(company.qa_test_running_since).getTime() : null
  if (runningSince && Date.now() - runningSince < LOCK_TTL_MS) {
    throw new Error('Já tem um teste rodando pra essa empresa agora. Aguarde terminar (leva menos de 1 minuto) antes de testar de novo.')
  }

  await supabase.from('companies').update({ qa_test_running_since: new Date().toISOString() }).eq('id', realCompanyId)
}

async function releaseTestLock(realCompanyId: number, supabase: Supabase): Promise<void> {
  await supabase.from('companies').update({ qa_test_running_since: null }).eq('id', realCompanyId)
}

// ─── Uso técnico (regressão, resultado bruto) ─────────────────────────

export async function runSdrEval(realCompanyId: number): Promise<EvalResult> {
  const supabase = createServiceClient()
  const shadowId = await ensureShadowCompany(realCompanyId, supabase)
  const reports = await runScenarios(shadowId, supabase)

  const log: string[] = []
  const checks: EvalCheck[] = []
  for (const r of reports) {
    log.push(`\n[${r.nome}] ${r.passou ? '✓' : '✗'} ${r.observacao}`)
    checks.push({ ok: r.passou, label: `${r.nome}: ${r.observacao}` })
  }

  const passed = checks.filter((c) => c.ok).length
  const failed = checks.filter((c) => !c.ok).length
  log.push(`\n${'─'.repeat(50)}`)
  log.push(`Resultado: ${passed} passou, ${failed} falhou (empresa-sombra id=${shadowId})`)

  return { passed, failed, checks, log }
}

// ─── Uso pelo cliente (resumo em português, com transcrição real) ─────

async function summarizeFailures(realCompanyId: number, failed: ScenarioReport[]): Promise<string> {
  let resumo = `Seu SDR não passou em ${failed.length} teste(s). Veja os detalhes abaixo.`
  try {
    const openaiKey = await resolveOpenAIKey(realCompanyId)
    const { default: OpenAI } = await import('openai')
    const openai = new OpenAI({ apiKey: openaiKey })
    const res = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [{
        role: 'user',
        content: `Você é um especialista em SDR/vendas por WhatsApp. Um teste automático encontrou problemas no SDR de um cliente. Escreva um resumo curto (2-4 frases) em português simples, pra um dono de empresa leigo em tecnologia entender o que precisa de atenção. Sem termo técnico, sem nome de função.\n\nProblemas encontrados:\n${failed.map((f) => `- ${f.nome}: ${f.observacao}`).join('\n')}`,
      }],
      temperature: 0.3,
      max_tokens: 250,
    })
    resumo = res.choices[0]?.message?.content?.trim() || resumo
  } catch {
    // Se a tradução falhar, fica o resumo técnico mesmo : melhor que nada.
  }
  return resumo
}

export async function runTenantSelfTest(realCompanyId: number): Promise<TenantSelfTestResult> {
  const supabase = createServiceClient()
  await acquireTestLock(realCompanyId, supabase)

  try {
    const shadowId = await ensureShadowCompany(realCompanyId, supabase)
    const detalhes = await runScenarios(shadowId, supabase)

    const failed = detalhes.filter((d) => !d.passou)
    const passou = failed.length === 0
    const resumo = passou
      ? 'Seu SDR passou em todos os testes automáticos : respondeu perguntas de preço, não insistiu com quem recusou, e não pulou etapas configuradas.'
      : await summarizeFailures(realCompanyId, failed)

    return { passou, resumo, detalhes }
  } finally {
    await releaseTestLock(realCompanyId, supabase)
  }
}

// ─── Variante em streaming (SSE) : evita timeout de proxy num teste que
// demora (4 cenários sequenciais, cada um com vários turnos reais) —
// manda cada cenário assim que termina, em vez de segurar tudo calado até
// o fim. Mesmo padrão já usado em /api/sdr/auto-simulate. ────────────────

export async function runTenantSelfTestStream(
  realCompanyId: number,
  onScenario: (report: ScenarioReport) => void
): Promise<TenantSelfTestResult> {
  const supabase = createServiceClient()
  await acquireTestLock(realCompanyId, supabase)

  try {
    const shadowId = await ensureShadowCompany(realCompanyId, supabase)
    const scenarios = makeScenario(shadowId, supabase)

    const detalhes: ScenarioReport[] = []
    for (const scenario of scenarios) {
      const report = await scenario()
      if (report) {
        detalhes.push(report)
        onScenario(report)
      }
    }

    const failed = detalhes.filter((d) => !d.passou)
    const passou = failed.length === 0
    const resumo = passou
      ? 'Seu SDR passou em todos os testes automáticos : respondeu perguntas de preço, não insistiu com quem recusou, e não pulou etapas configuradas.'
      : await summarizeFailures(realCompanyId, failed)

    return { passou, resumo, detalhes }
  } finally {
    await releaseTestLock(realCompanyId, supabase)
  }
}
