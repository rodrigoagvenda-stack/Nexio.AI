/**
 * Outbound (disparo frio) : port do fluxo n8n "Follow Outbound V2.0" pra código.
 *
 * Diferenças propositais em relação ao n8n original:
 * - Sem tool-calling/4 sub-agentes : só uma chamada de IA (geração da mensagem),
 *   o resto (limites, campanha, conversa) é CRUD direto.
 * - Rate limit por hora corrigido : rolling window real via `outbound_campaigns`,
 *   não staticData em memória (que nunca resetava entre dias no n8n).
 * - Horário comercial verificado em runtime (isWithinBusinessHours abaixo) :
 *   necessário porque o cron agora roda a cada minuto (ver anti-ban abaixo),
 *   diferente da versão anterior que confiava só nos horários fixos do cron.
 * - Anti-ban IDÊNTICO ao n8n original (mesmos valores do node "Delay
 *   Anti-Ban1" : 45-135s primeira abordagem, 120-300s follow-up), mas sem o
 *   "wait" preso dentro da função (inviável em serverless, timeout de 5min).
 *   Em vez disso : `companies.outbound_next_allowed_at` guarda o próximo
 *   horário liberado, calculado com o mesmo random do n8n após cada envio.
 *   O cron roda a cada minuto e só envia 1 mensagem por empresa por tick,
 *   respeitando esse campo : na prática, o espaçamento real entre leads
 *   fica igual ou mais preciso que o n8n, e sobrevive a redeploy/restart
 *   (o n8n perdia o wait se o worker reiniciasse no meio).
 * - Canal uazapi OU Meta (via `sendRichStepUnified`), não só uazapi.
 *
 * Gatilho de criação de campanha continua sendo o trigger de banco
 * `trigger_auto_campaign` em `leads` (status='Outbound') : este módulo só
 * consome campanhas que já existem em `outbound_campaigns`.
 */

import OpenAI from 'openai'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveOpenAIKey } from './rag'
import { sendRichStepUnified } from './rich-sender'
import { syslog } from '@/lib/logger'

type Supabase = ReturnType<typeof createServiceClient>

const HOURLY_CAP = 30
const OUTBOUND_MODEL = 'gpt-4.1-mini'

// Mesmos valores do node "Delay Anti-Ban1" do n8n original (.claude/outbound.json,
// linha 155) : primeira abordagem espera menos (é mais curta, menos "suspeita"),
// follow-up espera mais (2-5min, imita alguém revendo antes de insistir de novo).
function antiBanDelaySeconds(categoria: string): number {
  return categoria === 'primeira_abordagem'
    ? Math.floor(Math.random() * 90) + 45   // 45-135s
    : Math.floor(Math.random() * 180) + 120 // 120-300s
}

// Pausa em lote (2026-09-03) : a cada 10-15 disparos seguidos de uma empresa,
// força uma pausa maior, imitando alguém que trabalha em blocos e depois
// para pra fazer outra coisa, em vez de mandar contínuo o dia inteiro.
// Chance de pausar cresce entre o 10º e o 15º envio, garantida no 15º.
function shouldBatchPause(countAfterSend: number): boolean {
  if (countAfterSend < 10) return false
  if (countAfterSend >= 15) return true
  return Math.random() < (countAfterSend - 9) / 6
}

function batchPauseSeconds(): number {
  return Math.floor(Math.random() * 300) + 300 // 5-10min
}

/** Seg-Sex, 9h-18h, fuso America/Sao_Paulo : necessário em runtime porque o
 * cron passou a rodar a cada minuto (antes, os 5 horários fixos do cron já
 * eram o gate de horário comercial). */
function isWithinBusinessHours(): boolean {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(now)
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? ''
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0')
  const isWeekday = !['Sat', 'Sun'].includes(weekday)
  return isWeekday && hour >= 9 && hour < 18
}

interface Abertura {
  id: number
  categoria: string
  texto: string
}

// Pool de 100 aberturas, portado 1:1 do node "Abordagem Aleatoria" do n8n.
// Usadas só como inspiração pro prompt de geração : a IA reescreve, nunca copia literalmente.
// Reescrito : o pool de 100 aberturas anterior era, quase todo, o padrão que
// dados reais mostram que NÃO funciona (leading question tipo "posso te
// mostrar", estatística inventada, case fabricado, urgência falsa, conexão
// forjada). Baseado em Josh Braun (pergunta neutra, "poke the bear", nunca
// leading question com resposta óbvia) e Gong.io (300M+ ligações : abertura
// calorosa + motivo concreto e real aumenta taxa de sucesso, "did I catch
// you at a bad time" reduz 40%). Nenhuma entrada aqui promete resultado,
// inventa estatística, ou finge pesquisa/conexão que não existe : só
// observação real (o "Gap:" que vem do Buscar_analise_places) + pergunta
// neutra que deixa a pessoa completar o raciocínio sozinha.
const ABERTURAS: Abertura[] = [
  { id: 1, categoria: 'Observação Neutra', texto: 'Oi [Nome]! Reparei uma coisa no perfil de [empresa] no Google : [gap específico]. Isso costuma fazer o perfil aparecer menos nas buscas, sabia?' },
  { id: 2, categoria: 'Observação Neutra', texto: '[Nome], notei que [gap específico] no perfil de vocês no Google. Isso normalmente afeta como o negócio aparece pra quem procura na região.' },
  { id: 3, categoria: 'Observação Neutra', texto: 'Oi! Vi que o perfil da [empresa] no Google tá com [gap específico]. Isso é algo que vocês já tinham notado?' },
  { id: 4, categoria: 'Observação Neutra', texto: '[Nome], seu perfil no Google tem [gap específico]. Isso costuma ser o primeiro motivo de perfil não converter visita em cliente.' },
  { id: 5, categoria: 'Observação Neutra', texto: '[Nome], reparei [gap específico] no perfil de vocês no Google. Vale eu te contar o que encontrei?' },
  { id: 6, categoria: 'Pergunta Didática', texto: 'Oi [Nome]! Como você sabe se o perfil do seu negócio no Google tá trazendo cliente ou fazendo você perder pra concorrência sem perceber?' },
  { id: 7, categoria: 'Pergunta Didática', texto: '[Nome], você sabe dizer quantas pessoas acham seu negócio pelo Google todo mês, ou isso ainda é um número que ninguém olha?' },
  { id: 8, categoria: 'Pergunta Didática', texto: 'Oi! O que você acha que faz um negócio aparecer primeiro nas buscas do Google : sorte, ou tem um motivo técnico por trás?' },
  { id: 9, categoria: 'Pergunta Didática', texto: '[Nome], existe uma diferença grande entre negócio que aparece bem no Google e um que só existe lá. Você sabe em qual desses tá o seu hoje?' },
  { id: 10, categoria: 'Curiosidade Real', texto: 'Oi [Nome]! Passei pelo perfil da [empresa] e reparei algo específico que dá pra melhorar rápido. Vale eu te contar?' },
]

interface LeadDisponivel {
  id: number // outbound_campaigns.id
  lead_id: number | null
  contact_name: string
  whatsapp: string
  company_id: number
  tentativas: number
  max_tentativas: number
  template_usado: string | null
  status: string
  proximo_contato_em: string | null
  mensagens_enviadas_hoje: number
  limite_diario: number
  numero_bloqueado: boolean
  msgs_sem_resposta: number
}

export async function runOutboundDispatch(): Promise<{ processed: number; sent: number; errors: string[] }> {
  const supabase = createServiceClient()
  const errors: string[] = []
  let processed = 0
  let sent = 0

  // Horário comercial em runtime : o cron agora roda a cada minuto (pra
  // conseguir respeitar o espaçamento anti-ban de 45-300s entre leads), então
  // precisa desse gate aqui — antes disso era o próprio agendamento fixo do
  // cron (5 horários/dia) que garantia isso.
  if (!isWithinBusinessHours()) return { processed: 0, sent: 0, errors: [] }

  const { data: companies } = await supabase
    .from('companies')
    .select('id, features')
    .eq('is_active', true)
    .eq('is_shadow_company', false) // nunca disparar outbound de verdade pra empresa-sombra de teste

  const enabled = (companies ?? []).filter((c: any) => c.features?.outbound === true)

  for (const company of enabled) {
    try {
      sent += await dispatchForCompany(company.id, company.features ?? {}, supabase)
      processed++
    } catch (err: any) {
      errors.push(`Empresa ${company.id}: ${err.message}`)
      await syslog({
        type: 'outbound',
        severity: 'error',
        message: `Outbound error empresa ${company.id}: ${err.message}`,
        company_id: company.id,
        payload: { stack: err.stack?.slice(0, 500) },
      })
    }
  }

  if (sent > 0) {
    await syslog({ type: 'outbound', message: `Outbound: ${sent} mensagens enviadas`, payload: { processed, sent } })
  }

  return { processed, sent, errors }
}

/** Só 1 envio por empresa por tick (o cron roda a cada minuto) : o
 * espaçamento anti-ban entre leads diferentes vem de outbound_next_allowed_at,
 * não de processar um lote inteiro de uma vez como antes. */
async function dispatchForCompany(companyId: number, features: Record<string, unknown>, supabase: Supabase): Promise<number> {
  const { data: companyRow } = await supabase
    .from('companies')
    .select('outbound_next_allowed_at, outbound_batch_count')
    .eq('id', companyId)
    .maybeSingle()

  if (companyRow?.outbound_next_allowed_at && new Date(companyRow.outbound_next_allowed_at) > new Date()) {
    return 0 // ainda dentro do delay anti-ban do envio anterior
  }

  if (!(await withinHourlyRate(companyId, supabase))) return 0

  // Busca um pequeno buffer de candidatos (não só 1) pra poder pular quem
  // estiver bloqueado/frio/limite batido sem desperdiçar o tick inteiro.
  const { data: leads } = await supabase
    .from('vw_leads_disponiveis')
    .select('*')
    .eq('company_id', companyId)
    .lte('proximo_contato_em', new Date().toISOString())
    .order('proximo_contato_em', { ascending: true })
    .limit(10)

  const leadsDisponiveis = (leads ?? []) as LeadDisponivel[]
  if (!leadsDisponiveis.length) return 0

  const placesEnabled = features?.places_analysis === true

  const leadIds = leadsDisponiveis.map((l) => l.lead_id).filter((id): id is number => id != null)
  const { data: mqlRows } = leadIds.length
    ? await supabase.from('leads').select('id, mql_resumo, nivel_interesse, places_analysis').in('id', leadIds)
    : { data: [] as any[] }
  const mqlById = new Map((mqlRows ?? []).map((r: any) => [r.id, r]))

  let openai: OpenAI | null = null
  let persona: Persona | null = null
  let aberturasPool: Abertura[] | null = null

  for (const lead of leadsDisponiveis) {
    if (lead.numero_bloqueado) continue
    if (lead.mensagens_enviadas_hoje >= lead.limite_diario) continue
    const mql = lead.lead_id != null ? mqlById.get(lead.lead_id) : null
    if (mql?.nivel_interesse === 'Frio ❄️') continue

    try {
      if (!openai) {
        const openaiKey = await resolveOpenAIKey(companyId)
        openai = new OpenAI({ apiKey: openaiKey })
        persona = await fetchPersona(companyId, supabase)
        aberturasPool = await fetchOpenersPool(companyId, supabase)
      }

      const categoria = lead.tentativas === 0 ? 'primeira_abordagem' : lead.tentativas === 1 ? 'follow_up_1' : 'follow_up_2'
      const template = await fetchTemplate(companyId, categoria, supabase)

      // Empresa com Places ativo : contexto vem da análise de perfil Google
      // (gaps específicos do lead), não do mql_resumo genérico — é o
      // diferencial da mensagem pra essa empresa, não faz sentido diluir com
      // o resumo padrão de outra origem.
      const mqlResumo = placesEnabled && mql?.places_analysis?.summary
        ? mql.places_analysis.summary
        : mql?.mql_resumo ?? null

      // Mensagem(ns) já enviada(s) : achado ao vivo (2026-09-03) que a geração
      // não sabia em qual toque estava nem o que já tinha mandado, gerando
      // follow-up igual ao toque 1 (mesmo ângulo, sem escalar). Busca só
      // quando é follow-up : toque 1 não tem histórico.
      let previousMessage: string | null = null
      if (categoria !== 'primeira_abordagem') {
        const { data: prevRow } = await supabase
          .from('outbound_campaigns')
          .select('mensagem_enviada')
          .eq('id', lead.id)
          .maybeSingle()
        previousMessage = prevRow?.mensagem_enviada ?? null
      }

      const mensagem = await generateMessage(openai, {
        contactName: lead.contact_name,
        mqlResumo,
        categoria,
        previousMessage,
        templatePrompt: template?.prompt_sistema ?? null,
        persona,
        aberturasPool: aberturasPool ?? undefined,
      })

      const blocos = mensagem.split(/\n\n+/).map((b) => b.trim()).filter(Boolean)
      for (const bloco of blocos) {
        await sendRichStepUnified(companyId, lead.whatsapp, 'text', bloco)
      }

      await persistOutboundMessage(companyId, lead, mensagem, supabase)
      await advanceCampaign(companyId, lead, mensagem, supabase)
      await bumpLimits(companyId, lead.whatsapp, supabase)

      // Agenda o próximo horário liberado pra essa empresa : mesmo random do
      // n8n original, agora persistido em vez de "wait" preso na função.
      // Além disso, a cada 10-15 disparos seguidos, pausa 5-10min : delay
      // individual sozinho não basta, envio contínuo em sequência (mesmo
      // espaçado) ainda sinaliza atividade de bot pra faixas de detecção
      // que olham volume por janela, não só intervalo entre mensagens.
      const batchCount = (companyRow?.outbound_batch_count ?? 0) + 1
      const pause = shouldBatchPause(batchCount)
      const nextAllowedAt = new Date(
        Date.now() + (pause ? batchPauseSeconds() : antiBanDelaySeconds(categoria)) * 1000
      ).toISOString()
      await supabase
        .from('companies')
        .update({ outbound_next_allowed_at: nextAllowedAt, outbound_batch_count: pause ? 0 : batchCount })
        .eq('id', companyId)

      return 1
    } catch (err: any) {
      await supabase.from('outbound_campaigns_errors').insert({
        campaign_id: lead.id,
        error_type: 'dispatch',
        error_message: String(err?.message ?? 'erro desconhecido').slice(0, 500),
        whatsapp: lead.whatsapp,
      })
      return 0
    }
  }
  return 0 // nenhum candidato elegível no buffer (todos bloqueados/frios/limite batido)
}

/** Rolling 1h, por empresa : mesma convenção de `withinRateLimit` em lib/sdr/follow.ts */
async function withinHourlyRate(companyId: number, supabase: Supabase): Promise<boolean> {
  const since = new Date(Date.now() - 3_600_000).toISOString()
  const { count } = await supabase
    .from('outbound_campaigns')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .gte('ultima_abordagem', since)
  return (count ?? 0) < HOURLY_CAP
}

interface Persona {
  nomeAgente?: string
  tom?: string
  empresa?: string
  produto?: string
  restricoes?: string
}

/** Reaproveita a mesma persona do SDR (sdr_flows.orchestrator_prompt) : a Zaia
 * soa igual respondendo inbound ou abordando outbound, sem tela de config nova. */
async function fetchPersona(companyId: number, supabase: Supabase): Promise<Persona | null> {
  const { data } = await supabase
    .from('sdr_flows')
    .select('orchestrator_prompt')
    .eq('company_id', companyId)
    .eq('ativo', true)
    .limit(1)
    .maybeSingle()

  if (!data?.orchestrator_prompt) return null
  try {
    const parsed = JSON.parse(data.orchestrator_prompt)
    return {
      nomeAgente: parsed.nome_agente || undefined,
      tom: parsed.tom || undefined,
      empresa: parsed.empresa || undefined,
      produto: parsed.produto || undefined,
      restricoes: parsed.restricoes || undefined,
    }
  } catch {
    return null
  }
}

/** Pool de aberturas específico da empresa (gerado uma vez, revisável), guardado em
 * outbound_templates.exemplos (categoria='aberturas'). Cai pro pool genérico dos 100
 * se a empresa não tiver gerado o próprio ainda. */
async function fetchOpenersPool(companyId: number, supabase: Supabase): Promise<Abertura[]> {
  const { data } = await supabase
    .from('outbound_templates')
    .select('exemplos')
    .eq('company_id', companyId)
    .eq('categoria', 'aberturas')
    .eq('ativo', true)
    .limit(1)
    .maybeSingle()

  if (Array.isArray(data?.exemplos) && data.exemplos.length > 0) {
    const custom = data.exemplos.filter((e: any) => e?.texto).map((e: any, i: number) => ({
      id: i + 1,
      categoria: e.categoria || 'Personalizada',
      texto: String(e.texto),
    }))
    if (custom.length > 0) return custom
  }
  return ABERTURAS
}

async function fetchTemplate(companyId: number, categoria: string, supabase: Supabase): Promise<{ prompt_sistema: string } | null> {
  const { data } = await supabase
    .from('outbound_templates')
    .select('prompt_sistema')
    .eq('company_id', companyId)
    .eq('categoria', categoria)
    .eq('ativo', true)
    .limit(1)
    .maybeSingle()
  return data
}

async function generateMessage(
  openai: OpenAI,
  ctx: {
    contactName: string
    mqlResumo: string | null
    templatePrompt: string | null
    persona?: Persona | null
    aberturasPool?: Abertura[]
    categoria?: string
    previousMessage?: string | null
  }
): Promise<string> {
  const pool = ctx.aberturasPool?.length ? ctx.aberturasPool : ABERTURAS
  const abertura = pool[Math.floor(Math.random() * pool.length)]
  const p = ctx.persona

  // Diferenciação por toque (achado ao vivo, 2026-09-03 : a geração não sabia
  // em qual toque estava, gerando follow-up idêntico ao primeiro em ângulo,
  // sem escalar : dado real (Gong.io, cold-outreach benchmarks) mostra que a
  // maior parte da resposta vem do 2º-4º toque, não do 1º, e que a mensagem
  // de "breakup" no último toque costuma ter a maior taxa de resposta da
  // sequência inteira, por gerar perda em vez de insistência.
  const toqueBlock = ctx.categoria === 'follow_up_1'
    ? `\n\nESTE É O 2º TOQUE (follow-up), não o primeiro contato : o lead não respondeu a esta mensagem anterior:\n"${ctx.previousMessage ?? '(mensagem anterior não encontrada)'}"\nNUNCA repita o mesmo gancho ou frase da mensagem anterior. Traga um ângulo NOVO (outro achado, outra pergunta, outra forma de dizer), sem soar repetitivo ou insistente. NUNCA use frases tipo "não recebi retorno" ou "será que você viu minha mensagem" : dado real mostra que esse tipo de frase reduz a taxa de resposta.`
    : ctx.categoria === 'follow_up_2'
    ? `\n\nESTE É O ÚLTIMO TOQUE da sequência (3º e final), o lead não respondeu às 2 anteriores. A última foi:\n"${ctx.previousMessage ?? '(mensagem anterior não encontrada)'}"\nEscreva uma mensagem de ENCERRAMENTO educado, tipo "não vou insistir mais, mas fico à disposição se fizer sentido no futuro" : sem pressão, sem culpa, deixando a porta aberta. NÃO repita o gancho anterior, NÃO peça desculpa por insistir.`
    : ''

  // Achado ao vivo (2026-09-03) : citar o gap específico (mesmo só 1) ainda
  // dá pro lead contestar/rebater (caso Figueiredo) e, quando o achado é
  // fraco (ex: descrição curta numa imobiliária já forte), soa nitpicking.
  // Levando a Information Gap Theory até o fim : quando existe gap real
  // confirmado pela análise (gapCount >= 1), a mensagem sinaliza que algo foi
  // encontrado SEM dizer o quê, deixando o lead perguntar. Sem gap real
  // nenhum (sem análise Places ou perfil já impecável), mantém o gancho curto
  // genérico de sempre : não dá pra fingir achado que não existe.
  const gapCount = (ctx.mqlResumo?.match(/Gap:/g) ?? []).length
  const temGapReal = gapCount >= 1

  const systemPrompt = `Você é um especialista em prospecção fria via WhatsApp${p?.nomeAgente ? `, escrevendo como ${p.nomeAgente}` : ''}${p?.empresa ? ` da ${p.empresa}` : ''}. Gere UMA mensagem curta, natural e personalizada pra iniciar contato com um lead frio.
${p?.tom ? `\nTom de voz da empresa: ${p.tom}` : ''}
${p?.produto ? `Produto/serviço: ${p.produto}` : ''}
${p?.restricoes ? `Restrições : NUNCA quebrar: ${p.restricoes}` : ''}

REGRAS OBRIGATÓRIAS:
${temGapReal ? `- Cumprimente o lead pelo nome
- Diga que analisou/deu uma olhada no perfil da empresa no Google agora : NUNCA mencione site ou qualquer outro canal que não apareça no "Contexto sobre o lead" abaixo, só afirme que olhou o perfil do Google
- NÃO revele qual é o problema encontrado (não cite "Gap:" nenhum do contexto por nome). Apenas sinalize que achou um ponto relevante, no máximo com uma pista vaga de categoria de impacto (ex: "um ponto que costuma pesar na hora de aparecer na busca", "algo que pode afastar quem tá pesquisando"), nunca o achado específico : dizer qual mata a curiosidade (Information Gap Theory) e dá margem pro lead contestar um detalhe pontual. O objetivo é o lead perguntar "o que foi?", não a gente responder isso na mesma mensagem
- Máximo 50 palavras, pode quebrar em até 2 blocos (linha em branco entre eles)` : `- Máximo 40 palavras, máximo 3 linhas
- Se fizer sentido dividir em duas mensagens curtas, separe os blocos com uma linha em branco (no máximo 2 blocos)
- Sem gap real confirmado, use a abordagem de inspiração abaixo (categoria: ${abertura.categoria}), nunca invente um problema específico que não está no "Contexto sobre o lead".`}
- Sem markdown, sem negrito, sem itálico
- Máximo 1 emoji
- Sem CAIXA ALTA
- Nunca se apresente formalmente ("Olá, sou o assistente virtual da empresa X" é proibido)
- Sem gírias de vendedor genérico, sem slogans
- Linguagem humana e natural, como alguém mandando WhatsApp de verdade : "vc", reticências, vírgulas naturais
- Feche com UMA pergunta NEUTRA que deixa o lead completar o raciocínio sozinho (estilo Josh Braun, "poke the bear") : NUNCA pergunta do tipo "posso te mostrar/explicar como resolver", "quer que eu te mostre", "quer ajuda pra melhorar" ou "posso te contar qual" : todas são leading questions com resposta óbvia, dado real (Gong.io) mostra que reduzem resposta. Isso vale mesmo quando o achado tá escondido : NUNCA peça permissão pra revelar o que encontrou. Prefira algo tipo "Isso é algo que vocês já tinham notado?" ou uma pergunta didática sobre o tema, sem oferecer ajuda nem pedir permissão pra contar mais. Essa regra vale pro gancho curto também, não só quando tem gap real.
- Toda frase começa com letra maiúscula
- Use a abordagem abaixo só como INSPIRAÇÃO : nunca copie literalmente, reescreva com as próprias palavras, respeitando o tom da empresa acima

Abordagem de inspiração (categoria: ${abertura.categoria}):
"${abertura.texto}"
${ctx.templatePrompt ? `\nEsqueleto sugerido pela empresa (use como base, nunca copie literalmente):\n${ctx.templatePrompt}` : ''}${toqueBlock}`

  const userPrompt = `Nome do lead: ${ctx.contactName || 'não informado'}
${ctx.mqlResumo ? `Contexto sobre o lead:\n${ctx.mqlResumo}` : 'Sem contexto adicional sobre o lead : use apenas o nome, se houver.'}

Gere a mensagem agora.`

  const res = await openai.chat.completions.create({
    model: OUTBOUND_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.9,
    max_tokens: 300,
  })

  const text = res.choices[0]?.message?.content?.trim()
  if (!text) throw new Error('IA não retornou mensagem')
  return text
}

async function persistOutboundMessage(companyId: number, lead: LeadDisponivel, mensagem: string, supabase: Supabase): Promise<void> {
  const ts = new Date().toISOString()

  const { data: existing } = await supabase
    .from('conversas_do_whatsapp')
    .select('id')
    .eq('company_id', companyId)
    .eq('numero_de_telefone', lead.whatsapp)
    .maybeSingle()

  let conversationId: string
  if (existing?.id) {
    conversationId = String(existing.id)
    await supabase.from('conversas_do_whatsapp').update({
      ultima_mensagem: mensagem,
      hora_da_ultima_mensagem: ts,
    }).eq('id', existing.id)
  } else {
    const { data: created, error } = await supabase
      .from('conversas_do_whatsapp')
      .insert({
        company_id: companyId,
        id_do_lead: lead.lead_id,
        numero_de_telefone: lead.whatsapp,
        nome_do_contato: lead.contact_name,
        ultima_mensagem: mensagem,
        hora_da_ultima_mensagem: ts,
        status_da_conversa: 'aberto',
        contagem_nao_lida: 0,
      })
      .select('id')
      .single()
    if (error || !created?.id) {
      throw new Error(`persistOutboundMessage: falha ao criar conversa: ${error?.message ?? 'id nulo'}`)
    }
    conversationId = String(created.id)
  }

  await supabase.from('mensagens_do_whatsapp').insert({
    company_id: companyId,
    id_da_conversacao: conversationId,
    id_do_lead: lead.lead_id,
    texto_da_mensagem: mensagem,
    tipo_de_mensagem: 'text',
    direcao: 'outbound',
    sender_type: 'ai',
    carimbo_de_data_e_hora: ts,
    nome_do_agente: 'Outbound',
    status: 'sent',
  })
}

async function advanceCampaign(companyId: number, lead: LeadDisponivel, mensagem: string, supabase: Supabase): Promise<void> {
  const now = new Date()
  await supabase
    .from('outbound_campaigns')
    .update({
      status: 'enviado',
      tentativas: lead.tentativas + 1,
      ultima_abordagem: now.toISOString(),
      proximo_contato_em: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      mensagem_enviada: mensagem,
    })
    .eq('id', lead.id)
    .eq('company_id', companyId)
}

/**
 * Opt-out: chamado a partir do webhook inbound (uazapi/Meta) quando o lead
 * pede pra parar de receber mensagem (ver `isOptOutRequest` em engine.ts).
 * Marca o número bloqueado em `outbound_limits` — campo que `vw_leads_disponiveis`
 * já respeita, então o próximo tick do cron já para de tentar esse lead sozinho.
 */
export async function markOptOut(companyId: number, whatsapp: string, motivo: string): Promise<void> {
  const supabase = createServiceClient()
  const { data: existing } = await supabase
    .from('outbound_limits')
    .select('id')
    .eq('company_id', companyId)
    .eq('whatsapp', whatsapp)
    .maybeSingle()

  const payload = {
    numero_bloqueado: true,
    motivo_bloqueio: `opt-out: ${motivo}`.slice(0, 500),
    bloqueado_em: new Date().toISOString(),
  }

  if (existing?.id) {
    await supabase.from('outbound_limits').update(payload).eq('id', existing.id)
  } else {
    await supabase.from('outbound_limits').insert({ company_id: companyId, whatsapp, ...payload })
  }
}

async function bumpLimits(companyId: number, whatsapp: string, supabase: Supabase): Promise<void> {
  const hoje = new Date().toISOString().split('T')[0]
  const { data: existing } = await supabase
    .from('outbound_limits')
    .select('id, ultimo_reset, mensagens_enviadas_hoje')
    .eq('company_id', companyId)
    .eq('whatsapp', whatsapp)
    .maybeSingle()

  if (existing?.id) {
    const resetou = existing.ultimo_reset !== hoje
    await supabase
      .from('outbound_limits')
      .update({
        mensagens_enviadas_hoje: resetou ? 1 : (existing.mensagens_enviadas_hoje ?? 0) + 1,
        ultimo_reset: hoje,
      })
      .eq('id', existing.id)
  } else {
    await supabase.from('outbound_limits').insert({
      company_id: companyId,
      whatsapp,
      mensagens_enviadas_hoje: 1,
      ultimo_reset: hoje,
    })
  }
}
