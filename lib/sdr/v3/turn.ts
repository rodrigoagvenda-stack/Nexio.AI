/**
 * SDR v3: um turno completo (spec seção 2).
 * Extrator (IA entende) → estado → decisor (código decide) → ações em código → redator (IA escreve) → validador → envio → log.
 * Um único decisor por conversa: quando a v3 está ligada, o orquestrador antigo não roda.
 */
import type OpenAI from 'openai'
import type { createServiceClient } from '@/lib/supabase/server'
import { formatDateTimeBR } from '@/lib/google-calendar'
import { writeV3TurnLog } from '../turn-log'
import { agendarReuniao, cancelarReuniao, filtroDisponibilidade, ofertarHorarios, type AgendaCtx } from './agenda'
import { gerarCobranca } from './cobranca'
import { firstName, decidir, type DecisorCtx } from './decider'
import { extrair, type MsgHist } from './extractor'
import { getActiveConfig } from './config-store'
import { carregarEstado, salvarEstado } from './state'
import type { Acao, Estado, Etapa } from './types'
import { corrigirMecanico, norm, sentencas, validar, type Violacao } from './validator'
import { redigir } from './writer'
import { atualizarResumoIA } from './resumo'

type Supabase = ReturnType<typeof createServiceClient>

export interface V3Ctx {
  companyId: number
  leadId: number
  leadPhone: string
  leadName: string
  conversationId: string | null
  calendarId: string | null
  eventTitleTemplate: string | null
  asaasAtivo: boolean
  billingRecurring: boolean
  agendamentoConfirmadoNoTurno?: boolean
  pendingHandoff?: { motivo: string }
}

export interface V3Deps {
  supabase: Supabase
  openai: OpenAI
  send: (blocos: string[]) => Promise<void>
  log: (event: string, data: Record<string, unknown>) => Promise<void>
  search: (query: string) => Promise<string>
  onUsage: (c: OpenAI.Chat.ChatCompletion, agent: string) => void
  tokensDoTurno: () => number
  /** Modelo que REALMENTE respondeu em cada chamada deste turno (extrator/redator/resumo), lido direto da
   * resposta da API, não um texto fixo: acusa na hora quando o Sol falha e cai pro fallback (achado real,
   * 01/10/2026: o campo do log estava hardcoded 'gpt-4.1' desde antes da troca pro Sol, então nem eu nem o
   * Rodrigo conseguia confirmar pelo banco se o modelo novo estava rodando de verdade ou sempre caindo). */
  modelosDoTurno: () => string[]
  /** Avisa o responsável humano (config.escala) por WhatsApp. Usado no agendamento confirmado, além do handoff
   * (que já é avisado em engine.ts). Nunca derruba o turno se o envio falhar. */
  notificarResponsavel: (motivo: string, extra?: string) => Promise<void>
}

export interface V3Params {
  ctx: V3Ctx
  deps: V3Deps
  historico: MsgHist[]
  mensagemAtual: string
  pushName: string | null
}

const STATUS_CRM: Partial<Record<Etapa, string>> = {
  qualificando: 'Em contato',
  oferta_horario: 'Interessado',
  confirmando: 'Interessado',
  agendado: 'Proposta enviada',
  encerrado: 'Perdido',
}

const asList = (t: string | string[]) => (Array.isArray(t) ? t : [t])
const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o))

function contemLiteral(blocos: string[], literal: string[]): boolean {
  const saida = norm(blocos.join(' '))
  return literal.every((l) => saida.includes(norm(l).replace(/[.!?]+$/, '')))
}

export async function runV3Turn(p: V3Params): Promise<{ handled: boolean; motivo?: string }> {
  const { ctx, deps, historico, mensagemAtual } = p
  const { supabase, openai } = deps
  const t0 = Date.now()

  const cfgRow = await getActiveConfig(ctx.companyId, supabase)
  const conv = Number(ctx.conversationId)
  if (!cfgRow || !Number.isFinite(conv)) {
    await deps.log('v3_sem_config', { temConfig: !!cfgRow })
    return { handled: false, motivo: 'sem_config' }
  }
  const config = cfgRow.config

  const { data: lead } = await supabase.from('leads').select('*').eq('id', ctx.leadId).eq('company_id', ctx.companyId).maybeSingle()
  const { estado: estadoIn, novo } = await carregarEstado(supabase, ctx.companyId, conv, cfgRow.version)
  const primeiraMensagemNossa = !historico.some((m) => m.role === 'assistant')
  // Reunião existe quando call_status diz que existe, ponto: nunca exige calendar_event_id pra isso (achado real,
  // lead Elane/conv883, 30/09/2026 — reunião marcada NA MÃO pelo Bruno, sem passar pelo agendarReuniao() do bot,
  // ficou sem calendar_event_id; o gate de "já existe reunião" nunca reconheceu, e o v3 tratou a resposta dela
  // sobre a reunião como lead novo, caindo direto numa pergunta de qualificação). calendar_event_id continua
  // exigido só na hora de CANCELAR de verdade no Google Calendar (a chamada de API precisa do id real).
  const agendada = lead?.call_status === 'agendada'
  if (novo) {
    estadoIn.etapa = agendada ? 'agendado' : primeiraMensagemNossa ? 'abertura' : 'qualificando'
    if (typeof lead?.segment === 'string' && lead.segment.trim()) estadoIn.dados.segmento = lead.segment.trim()
  }

  // Contexto que o código carrega sem LLM: análise de perfil (Buscar_analise_places), origem outbound e anúncio
  const analysis = (lead?.places_analysis ?? null) as { score?: { total: number }; gaps?: { titulo: string; texto: string; unknown?: boolean }[] } | null
  if (analysis?.score && !estadoIn.dados.tem_perfil_google) estadoIn.dados.tem_perfil_google = 'sim (análise de perfil do Google)'
  let contextoOutbound: string | null = null
  let origemAnuncio: string | null = null
  if (novo) {
    const { data: camp } = await supabase
      .from('outbound_campaigns')
      .select('mensagem_enviada')
      .eq('company_id', ctx.companyId)
      .eq('whatsapp', ctx.leadPhone)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    contextoOutbound = camp?.mensagem_enviada ?? null
    const { data: attr } = await supabase
      .from('attribution_events')
      .select('referral_headline')
      .eq('conversation_id', ctx.conversationId)
      .not('referral_headline', 'is', null)
      .order('captured_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    origemAnuncio = attr?.referral_headline ?? null
  }
  const reuniaoExistente =
    agendada && lead?.call_agendada_para && new Date(lead.call_agendada_para).getTime() > Date.now() ? formatDateTimeBR(new Date(lead.call_agendada_para)) : null

  const estadoAntes = clone(estadoIn)

  // A automação (follow, remarketing, promoção, anti no-show) roda por fora do v3: o estado dele não sabe que ela
  // falou. Se a última coisa que NÓS mandamos foi uma automação, a mensagem do lead é resposta a ela.
  const { data: ultimaSaida } = await supabase
    .from('mensagens_do_whatsapp')
    .select('source, texto_da_mensagem, metadados')
    .eq('id_da_conversacao', ctx.conversationId)
    .eq('direcao', 'outbound')
    .order('carimbo_de_data_e_hora', { ascending: false })
    .limit(1)
    .maybeSingle()
  const origemAutomacao = typeof ultimaSaida?.source === 'string' && /^(remarketing|antinoshow|follow:)/.test(ultimaSaida.source) ? ultimaSaida.source : null
  const contextoAutomacao = origemAutomacao
    ? {
        origem: origemAutomacao,
        conteudo: String((ultimaSaida?.metadados as { transcricao?: string } | null)?.transcricao ?? ultimaSaida?.texto_da_mensagem ?? ''),
      }
    : null

  // [1] Extrator
  const extracao = await extrair(openai, { config, estado: estadoIn, historico: historico.slice(novo ? -30 : -8), mensagemAtual, contextoAutomacao }, deps.onUsage)

  // Efeitos de CRM do que o lead disse (nome, segmento) e do disparo outbound (respondeu, score, bot)
  if (extracao.dados.nome && !estadoIn.dados.nome) {
    await supabase.from('leads').update({ contact_name: extracao.dados.nome_completo || extracao.dados.nome, updated_at: new Date().toISOString() }).eq('id', ctx.leadId).eq('company_id', ctx.companyId)
    await supabase.from('conversas_do_whatsapp').update({ nome_do_contato: extracao.dados.nome }).eq('id', ctx.conversationId).eq('company_id', ctx.companyId)
  }
  if (extracao.dados.segmento) await supabase.from('leads').update({ segment: extracao.dados.segmento }).eq('id', ctx.leadId).eq('company_id', ctx.companyId)
  if (novo && contextoOutbound) {
    const I = new Set(extracao.intencoes)
    const score = extracao.resposta_automatica ? 0 : I.has('quer_agendar') || I.has('escolheu_horario') ? 10 : I.has('recusa') ? 2 : I.has('pergunta_preco') || I.has('pergunta_fato') || I.has('objecao') ? 6 : 5
    await supabase
      .from('outbound_campaigns')
      .update({ respondeu: true, respondeu_em: new Date().toISOString(), resposta_recebida: mensagemAtual.slice(0, 1000), resposta_bot: extracao.resposta_automatica, score_interesse: score })
      .eq('company_id', ctx.companyId)
      .eq('whatsapp', ctx.leadPhone)
  }

  // [2][3] Estado e decisor
  const dctx: DecisorCtx = {
    temCalendario: !!ctx.calendarId && config.agendamento.ativo,
    cobrancaAtiva: ctx.asaasAtivo && config.cobranca?.ativo === true && !!config.cobranca.valor && !!config.cobranca.descricao,
    primeiraMensagemNossa,
    pushName: p.pushName,
    contextoOutbound,
    origemAnuncio,
    reuniaoExistente,
    temReuniaoAtiva: agendada,
    respondendoAutomacao: !!origemAutomacao,
    mensagemLead: mensagemAtual,
  }
  const decisao = decidir(extracao, estadoIn, config, dctx)
  const estado: Estado = decisao.estado
  let acao: Acao = decisao.acao
  const fatosRecuperados: unknown[] = []
  const agendaCtx: AgendaCtx | null = ctx.calendarId
    ? { companyId: ctx.companyId, leadId: ctx.leadId, leadPhone: ctx.leadPhone, calendarId: ctx.calendarId, eventTitleTemplate: ctx.eventTitleTemplate }
    : null

  const virarEscalar = (motivo: string, duvida = false) => {
    acao = {
      ...acao,
      tipo: duvida ? 'escalar_duvida' : 'escalar',
      conteudo: { modo: 'literal', texto: duvida ? config.escala.frase_duvida : config.escala.frase },
      proxima_pergunta: null,
      fatos: [],
      bloco_fixo: undefined,
      consulta_rag: undefined,
      handoff: { motivo },
      etapa_depois: 'escalado',
    }
    estado.etapa = 'escalado'
  }
  const ofertar = async (prefixo = ''): Promise<boolean> => {
    if (!agendaCtx) return false
    const filtro = filtroDisponibilidade(estado.dados.disponibilidade)
    const jaOfertados = (estado.dados._slots ?? '').split(',').filter(Boolean)
    // Calendar fora do ar (achado real, 29/09 12:27-12:33: "invalid_request" do Google): antes o erro derrubava o
    // turno inteiro e o motor antigo respondia no lugar. Agora vira "sem horário" e a conversa vai pra pessoa.
    let of: Awaited<ReturnType<typeof ofertarHorarios>> = null
    try {
      of = await ofertarHorarios(agendaCtx, { filtro, jaOfertados })
    } catch (err: any) {
      await deps.log('v3_calendario_erro', { erro: err?.message ?? 'erro' }).catch(() => {})
      return false
    }
    if (!of) return false
    acao.bloco_fixo = `${prefixo}${of.texto}`
    estado.dados._slots = of.slots.join(',')
    estado.contadores.horarios_ofertados = true
    estado.contadores.ofertas_horario = (estado.contadores.ofertas_horario ?? 0) + 1
    acao.etapa_depois = 'oferta_horario'
    return true
  }

  // Ações que o código executa (agendamento, cobrança, busca de fatos), nunca a IA
  if (acao.tipo === 'responder_fato' && acao.consulta_rag) {
    const rag = await deps.search(acao.consulta_rag)
    fatosRecuperados.push({ base: 'conhecimento', query: acao.consulta_rag.slice(0, 200), vazio: !rag, tamanho: rag.length })
    if (rag) acao.fatos.push({ id: 'rag', texto: rag })
    if (acao.fatos.length === 0) virarEscalar('dúvida sem fato na base', true)
  }
  if (acao.tipo === 'oferecer_horarios') {
    if (!(await ofertar())) virarEscalar('sem horários livres para oferecer')
    else if (analysis?.gaps) {
      const gap = analysis.gaps.filter((g) => !g.unknown)[0]
      if (gap) acao.fatos.push({ id: 'places_gap', texto: `Na análise do perfil dele achamos: ${gap.titulo}. ${gap.texto}. Há mais pontos que o especialista mostra na conversa.` })
    }
  }
  if (acao.tipo === 'agendar') {
    const nomeCompleto = estado.dados.nome_completo || estado.dados.nome
    // Reunião já existia nesse turno (remarcação): cancela o evento antigo depois de criar o novo, nunca deixa os dois soltos.
    const eventoParaCancelar = reuniaoExistente ? (lead?.calendar_event_id ?? undefined) : undefined
    const r = await agendarReuniao(agendaCtx!, supabase, { dataHora: estado.dados.horario_escolhido, email: estado.dados.email, nomeCompleto, eventoParaCancelar })
    if (r.ok) {
      ctx.agendamentoConfirmadoNoTurno = true
      estado.etapa = 'agendado'
      acao.etapa_depois = 'agendado'
      acao.bloco_fixo = `${firstName(nomeCompleto)}, agendado! ${r.dataFormatada}.\n\nTe enviei o convite por e-mail com o link da reunião. Conseguiu receber?`
      await salvarEstado(supabase, ctx.companyId, conv, estado).catch(() => {})
      const linkGmn = /https?:\/\/\S+/.exec(estado.dados.tem_perfil_google ?? '')?.[0]
      await deps.notificarResponsavel(
        'reunião agendada',
        `Lead: ${nomeCompleto}\nWhatsApp: ${ctx.leadPhone}\nData: ${r.dataFormatada}\nLink da reunião: ${r.meetUrl}${linkGmn ? `\nPerfil do Google: ${linkGmn}` : ''}`,
      )
    } else if (r.motivo === 'indisponivel') {
      delete estado.dados.horario_escolhido
      acao.tipo = 'oferecer_horarios'
      estado.etapa = 'qualificando'
      if (!(await ofertar('Esse horário não está mais disponível. '))) virarEscalar('horário indisponível e sem outros livres')
    } else {
      virarEscalar(`erro ao agendar: ${r.detalhe}`)
    }
  }
  if (acao.tipo === 'cancelar_reuniao') {
    if (!lead?.calendar_event_id) {
      if (reuniaoExistente) {
        // Reunião real e confirmada (call_status='agendada'), mas sem calendar_event_id pra cancelar de
        // verdade no Google Calendar (ex.: marcada na mão pelo Bruno, fora do fluxo do bot: achado real,
        // lead Elane/conv883, 30/09/2026). NUNCA diz "já está cancelado" quando não está: chama alguém.
        virarEscalar('lead pediu para cancelar reunião que não tem calendar_event_id (marcada fora do fluxo do bot)')
      } else {
        // Não tem evento de verdade nem reunião ativa registrada (banco desatualizado ou já cancelado antes):
        // não erra, só confirma o que já é fato.
        acao.bloco_fixo = 'Já está cancelado por aqui. Se quiser marcar de novo depois, é só me chamar.'
      }
    } else {
      const r = await cancelarReuniao(agendaCtx!, supabase, lead.calendar_event_id)
      if (r.ok) {
        acao.bloco_fixo = 'Cancelado! Quando quiser remarcar, é só me chamar por aqui.'
        await salvarEstado(supabase, ctx.companyId, conv, estado).catch(() => {})
      } else {
        virarEscalar(`erro ao cancelar: ${r.detalhe}`)
      }
    }
  }
  if (acao.tipo === 'gerar_cobranca') {
    const r = await gerarCobranca(
      { companyId: ctx.companyId, leadId: ctx.leadId, leadName: estado.dados.nome_completo || estado.dados.nome || '', leadPhone: ctx.leadPhone, cpfCnpj: estado.dados.cpf_cnpj, valor: config.cobranca!.valor!, descricao: config.cobranca!.descricao!, recorrente: ctx.billingRecurring },
      supabase,
    )
    if (r.ok) acao.bloco_fixo = r.texto
    else {
      await deps.log('charge_generation_failed', { detalhe: r.detalhe })
      virarEscalar(`falha ao gerar cobrança: ${r.detalhe}`)
    }
  }

  // [4] Redator (ou conteúdo literal / bloco fixo montado pelo código)
  let regenerou = false
  let redatorBlocos: string[] = []
  let usouLLM = false
  let fatosUsados: string[] = []
  const literal = acao.conteudo?.modo === 'literal' ? asList(acao.conteudo.texto) : null
  const soLiteral = !!literal && !acao.reacao_social && !acao.proxima_pergunta && !acao.bloco_fixo

  const escrever = async (violacoes?: Violacao[], anterior?: string[]): Promise<string[]> => {
    usouLLM = true
    if (acao.bloco_fixo) {
      const r = acao.reacao_social ? await redigir(openai, { config, acao, historico, frasesEnviadas: estado.frases_enviadas, soReacao: true, violacoes, anterior }, deps.onUsage) : { blocos: [], fatos_usados: [] }
      return [...r.blocos.slice(0, 1), ...acao.bloco_fixo.split(/\n\n+/)]
    }
    const r = await redigir(openai, { config, acao, historico, frasesEnviadas: estado.frases_enviadas, violacoes, anterior }, deps.onUsage)
    fatosUsados = r.fatos_usados
    return r.blocos
  }

  let blocos: string[] = acao.silencio ? [] : soLiteral ? literal! : await escrever()
  redatorBlocos = clone(blocos)

  // Conteúdo literal tem que sair como está: se o redator mexeu, regenera 1x e depois usa o literal direto
  const litFalhou = () => !!literal && !soLiteral && !contemLiteral(blocos, literal)
  if (litFalhou()) {
    regenerou = true
    blocos = await escrever([{ regra: 'LITERAL', modo: 'bloqueia', detalhe: 'o conteúdo literal foi alterado' }], blocos)
    if (litFalhou()) blocos = [...literal!, ...(acao.proxima_pergunta ? [acao.proxima_pergunta.texto] : [])]
  }

  // Redator não achou fato para responder: é dúvida sem fonte, vai para a pessoa
  if (acao.tipo === 'responder_fato' && usouLLM && !acao.fatos.some((f) => f.id === 'reuniao_existente') && fatosUsados.length === 0) {
    virarEscalar('dúvida que os fatos não respondem', true)
    blocos = [config.escala.frase_duvida]
  }

  // [5] Validador
  const vctx = () => ({
    config,
    estado,
    acao,
    mensagensDoLead: [...historico.filter((m) => m.role === 'user').slice(-8).map((m) => m.content), mensagemAtual],
    ultimasNossas: historico.filter((m) => m.role === 'assistant').map((m) => m.content).reverse().slice(0, 4),
    eventoConfirmadoNoTurno: ctx.agendamentoConfirmadoNoTurno === true,
  })
  let violacoes = acao.silencio ? [] : validar(blocos, vctx())
  let bloq = violacoes.filter((v) => v.modo === 'bloqueia')
  if (bloq.length > 0 && usouLLM && !soLiteral && !regenerou) {
    regenerou = true
    blocos = await escrever(bloq, blocos)
    violacoes = [...violacoes, ...validar(blocos, vctx()).map((v) => ({ ...v, detalhe: `(2ª versão) ${v.detalhe}` }))]
    bloq = validar(blocos, vctx()).filter((v) => v.modo === 'bloqueia')
  }
  if (bloq.some((v) => ['V4', 'V5', 'V6', 'V10'].includes(v.regra))) {
    virarEscalar(`resposta bloqueada pelo validador: ${bloq.map((v) => v.regra).join(', ')}`)
    blocos = [config.escala.frase]
  } else if (bloq.length > 0) {
    blocos = corrigirMecanico(blocos, vctx(), bloq)
  }
  blocos = blocos.map((b) => b.replace(/\s*[—–]\s*/g, ', ').trim()).filter(Boolean)

  // Envio (em blocos, com digitando e atraso: o motor de envio atual)
  if (blocos.length > 0) await deps.send(blocos)
  if (acao.handoff) ctx.pendingHandoff = acao.handoff

  // Depois do envio nada pode derrubar o turno (evita reenviar no retry do worker)
  try {
    if (estado.etapa !== 'escalado' && estado.etapa !== 'encerrado') estado.etapa = acao.etapa_depois
    estado.frases_enviadas = [...estado.frases_enviadas, ...blocos.flatMap(sentencas).map(norm)].slice(-30)
    if (acao.proxima_pergunta && blocos.some((b) => b.includes('?'))) {
      estado.perguntas_feitas.push({ id: acao.proxima_pergunta.id, turno: estado.turno, respondida: false })
      estado.contadores.ultimo_id_perguntado = acao.proxima_pergunta.id
    }
    await salvarEstado(supabase, ctx.companyId, conv, estado)

    const novoStatus = STATUS_CRM[estado.etapa]
    if (novoStatus && estado.etapa !== estadoAntes.etapa && lead?.status !== 'Fechado') {
      await supabase.from('leads').update({ status: novoStatus, updated_at: new Date().toISOString() }).eq('id', ctx.leadId).eq('company_id', ctx.companyId)
    }

    await writeV3TurnLog(supabase, {
      companyId: ctx.companyId,
      conversationId: conv,
      leadId: ctx.leadId,
      turno: estado.turno,
      extracao,
      estadoAntes,
      estadoDepois: estado,
      acao: { tipo: acao.tipo, reacao_social: acao.reacao_social, conteudo: acao.conteudo, proxima_pergunta: acao.proxima_pergunta, handoff: acao.handoff ?? null, bloco_fixo: acao.bloco_fixo ?? null, fatos: acao.fatos.map((f) => f.id) },
      fatosRecuperados,
      redatorBlocos,
      violacoes,
      regenerou,
      blocosEnviados: blocos,
      tokens: deps.tokensDoTurno(),
      latenciaMs: Date.now() - t0,
      configVersion: cfgRow.version,
      modelo: deps.modelosDoTurno().join(', ') || undefined,
    })
    await deps.log('v3_turno', { turno: estado.turno, acao: acao.tipo, etapa: estado.etapa, violacoes: violacoes.map((v) => `${v.regra}:${v.modo}`) })

    // Resumo executivo pro painel (LeadInfoSidebar): só gasta a chamada quando o turno tem chance real de
    // trazer novidade (achado 27/09/2026: v3 nunca escrevia em resumo_ia). Turno só social/"outro" sem
    // nenhum dado novo capturado e sem ação relevante não vale a chamada.
    const acaoRelevante = ['agendar', 'gerar_cobranca', 'escalar', 'escalar_duvida', 'oferecer_horarios', 'responder_preco', 'responder_como_funciona', 'responder_fato'].includes(acao.tipo)
    const soSocialOuOutro = extracao.intencoes.every((i) => i === 'social' || i === 'outro')
    if (Object.keys(extracao.dados).length > 0 || acaoRelevante || !soSocialOuOutro) {
      await atualizarResumoIA(openai, supabase, {
        companyId: ctx.companyId,
        leadId: ctx.leadId,
        resumoAtual: (lead?.resumo_ia as string | null) ?? null,
        mensagemLead: mensagemAtual,
        respostaSdr: blocos.join(' '),
        dadosNovos: extracao.dados,
      }, deps.onUsage)
    }
  } catch (err: any) {
    console.error(`[SDR v3:${ctx.companyId}] pós-envio falhou (ignorado):`, err?.message)
    await deps.log('v3_pos_envio_falhou', { erro: err?.message ?? 'erro' }).catch(() => {})
  }
  return { handled: true }
}
