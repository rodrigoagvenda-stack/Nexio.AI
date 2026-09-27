/**
 * Teste real, ponta a ponta, dos 3 cenários de "reunião marcada" (imprevisto, novo horário direto,
 * ligação), com o Google Calendar de VERDADE da empresa (cria e cancela evento de verdade). Só roda
 * quando pedido explicitamente (mexe na agenda real), diferente de self-test-live.ts (que nunca toca
 * no Calendar). Usa um lead de teste próprio (nome "TESTE CLAUDE", claramente marcado), apagado no
 * final. O evento final também é cancelado no final, não fica nada pra trás.
 */
import OpenAI from 'openai'
import { createServiceClient } from '@/lib/supabase/server'
import { getActiveConfig } from './config-store'
import { resolveOpenAIKey } from '../rag'
import { decidir, type DecisorCtx } from './decider'
import { extrair, type MsgHist } from './extractor'
import { redigir } from './writer'
import { validar, corrigirMecanico, type Violacao } from './validator'
import { ESTADO_INICIAL, type Estado } from './types'
import type { CompanyConfig } from './config-types'
import { agendarReuniao, ofertarHorarios, type AgendaCtx } from './agenda'
import { cancelEvent, getEvent, formatDateTimeBR, parseBrazilDateTime } from '@/lib/google-calendar'

const asList = (t: string | string[]) => (Array.isArray(t) ? t : [t])

export interface PassoResultado {
  passo: string
  lead: string
  sdr: string
  acao: string
  ok: boolean
  detalhe: string
}

async function turnoComCalendario(
  openai: OpenAI,
  supabase: ReturnType<typeof createServiceClient>,
  config: CompanyConfig,
  agendaCtx: AgendaCtx,
  estadoIn: Estado,
  historico: MsgHist[],
  mensagemAtual: string,
  ctxParcial: Partial<DecisorCtx>,
  eventoParaCancelar?: string,
) {
  const extracao = await extrair(openai, { config, estado: estadoIn, historico, mensagemAtual })
  const ctx: DecisorCtx = {
    temCalendario: true,
    cobrancaAtiva: false,
    primeiraMensagemNossa: historico.length === 0,
    pushName: null,
    contextoOutbound: null,
    origemAnuncio: null,
    reuniaoExistente: null,
    mensagemLead: mensagemAtual,
    ...ctxParcial,
  }
  const { estado, acao } = decidir(extracao, estadoIn, config, ctx)

  // Mesmas ações em código que o turn.ts de produção executa (aqui, de verdade, contra o Calendar real)
  let eventoNovoId: string | undefined
  if (acao.tipo === 'oferecer_horarios') {
    const of = await ofertarHorarios(agendaCtx)
    if (of) {
      acao.bloco_fixo = of.texto
      estado.dados._slots = of.slots.join(',')
    }
  }
  if (acao.tipo === 'agendar') {
    const nomeCompleto = estado.dados.nome_completo || estado.dados.nome
    const r = await agendarReuniao(agendaCtx, supabase, { dataHora: estado.dados.horario_escolhido, email: estado.dados.email, nomeCompleto, eventoParaCancelar })
    if (r.ok) {
      acao.bloco_fixo = `${nomeCompleto}, agendado! ${r.dataFormatada}.\n\nTe enviei o convite por e-mail com o link da reunião. Conseguiu receber?`
      eventoNovoId = r.eventId
    } else {
      acao.bloco_fixo = undefined
    }
  }

  const literal = acao.conteudo?.modo === 'literal' ? asList(acao.conteudo.texto) : null
  const soLiteral = !!literal && !acao.reacao_social && !acao.proxima_pergunta && !acao.bloco_fixo
  let blocos: string[]
  if (soLiteral) blocos = literal!
  else if (acao.bloco_fixo) {
    const r = acao.reacao_social ? await redigir(openai, { config, acao, historico, frasesEnviadas: estado.frases_enviadas, soReacao: true }) : { blocos: [] as string[] }
    blocos = [...r.blocos.slice(0, 1), ...acao.bloco_fixo.split(/\n\n+/)]
  } else {
    const r = await redigir(openai, { config, acao, historico, frasesEnviadas: estado.frases_enviadas })
    blocos = r.blocos
  }
  const violacoes: Violacao[] = validar(blocos, {
    config, estado, acao,
    mensagensDoLead: [...historico.filter((m) => m.role === 'user').map((m) => m.content), mensagemAtual],
    ultimasNossas: historico.filter((m) => m.role === 'assistant').map((m) => m.content).reverse(),
    eventoConfirmadoNoTurno: !!eventoNovoId,
  })
  const bloq = violacoes.filter((v) => v.modo === 'bloqueia')
  if (bloq.length > 0) blocos = corrigirMecanico(blocos, { config, estado, acao, mensagensDoLead: [], ultimasNossas: [], eventoConfirmadoNoTurno: false }, bloq)
  return { estado, acao, blocos, eventoNovoId }
}

export async function runV3CalendarRealTest(companyId = 30): Promise<{ passos: PassoResultado[]; passou: boolean }> {
  const supabase = createServiceClient()
  const cfgRow = await getActiveConfig(companyId, supabase)
  if (!cfgRow) throw new Error(`sem config v3 ativa pra company ${companyId}`)
  const config = cfgRow.config
  const openai = new OpenAI({ apiKey: await resolveOpenAIKey(companyId) })

  const { data: sdrCfg } = await supabase.from('sdr_configs').select('google_calendar_id').eq('company_id', companyId).single()
  const calendarId = sdrCfg?.google_calendar_id
  if (!calendarId) throw new Error('empresa sem Google Calendar configurado')

  const passos: PassoResultado[] = []
  const testePhone = `55TESTE${Date.now().toString().slice(-8)}`
  let leadId: number | undefined
  let conversationId: number | undefined
  let eventoAtualId: string | undefined
  let eventoAtualFormatado: string | undefined

  try {
    // Setup: lead de teste, claramente marcado
    const { data: lead, error: leadErr } = await supabase
      .from('leads')
      .insert({ company_id: companyId, contact_name: 'TESTE CLAUDE (apagar)', company_name: 'TESTE CLAUDE (apagar)', whatsapp: testePhone, status: 'Em contato', origem: 'teste_interno' })
      .select('id')
      .single()
    if (leadErr || !lead) throw new Error(`falha ao criar lead de teste: ${leadErr?.message}`)
    leadId = lead.id
    const { data: conv, error: convErr } = await supabase
      .from('conversas_do_whatsapp')
      .insert({ company_id: companyId, numero_de_telefone: testePhone, id_do_lead: leadId, nome_do_contato: 'TESTE CLAUDE (apagar)' })
      .select('id')
      .single()
    if (convErr || !conv) throw new Error(`falha ao criar conversa de teste: ${convErr?.message}`)
    conversationId = conv.id

    const agendaCtx: AgendaCtx = { companyId, leadId: leadId!, leadPhone: testePhone, calendarId, eventTitleTemplate: null }

    // Passo 0: agenda a reunião inicial de verdade (mesma função que a produção usa)
    const oferta0 = await ofertarHorarios(agendaCtx)
    if (!oferta0) throw new Error('sem horário livre pra testar (agenda da empresa cheia?)')
    const primeiroSlot = oferta0.slots[0]
    const r0 = await agendarReuniao(agendaCtx, supabase, { dataHora: primeiroSlot, email: 'teste.claude@example.com', nomeCompleto: 'Teste Claude Silva' })
    if (!r0.ok) throw new Error(`falha ao criar a reunião inicial de teste: ${r0.detalhe}`)
    eventoAtualId = r0.eventId
    eventoAtualFormatado = r0.dataFormatada
    passos.push({ passo: '0. Setup: cria reunião real de teste', lead: '(setup)', sdr: `Reunião criada de verdade pra ${r0.dataFormatada}`, acao: 'agendar', ok: true, detalhe: `evento ${r0.eventId}` })

    let estado: Estado = { ...ESTADO_INICIAL(cfgRow.version), etapa: 'agendado', dados: { nome: 'Teste', negocio: 'empresa teste em São Paulo', tem_perfil_google: 'sim', escopo: 'gmn', decisor: 'sim', email: 'teste.claude@example.com', nome_completo: 'Teste Claude Silva' } }
    let historico: MsgHist[] = [{ role: 'assistant', content: `Teste Claude Silva, agendado! ${eventoAtualFormatado}.` }]

    // Passo 1: avisa imprevisto -> tem que oferecer horários NOVOS de verdade (consulta real ao Calendar)
    let msg = 'Poxa, vou ter um imprevisto, não vou poder nesse horário, dá pra mudar?'
    let t = await turnoComCalendario(openai, supabase, config, agendaCtx, estado, historico, msg, { reuniaoExistente: eventoAtualFormatado })
    const ofereceuHorarioDeVerdade = t.acao.tipo === 'oferecer_horarios' && !!t.acao.bloco_fixo && !!t.estado.dados._slots
    passos.push({ passo: '1. Avisa imprevisto', lead: msg, sdr: t.blocos.join(' | '), acao: t.acao.tipo, ok: ofereceuHorarioDeVerdade, detalhe: ofereceuHorarioDeVerdade ? `ofereceu de verdade: ${t.estado.dados._slots}` : 'não ofereceu horário real' })
    estado = t.estado
    historico = [...historico, { role: 'user', content: msg }, { role: 'assistant', content: t.blocos.join(' ') }]

    // Passo 2: escolhe um dos horários oferecidos de verdade -> tem que criar evento novo E cancelar o antigo de verdade
    const novosSlots = (estado.dados._slots ?? '').split(',').filter(Boolean)
    if (novosSlots.length === 0) throw new Error('passo 1 não ofereceu slot nenhum, não dá pra continuar o passo 2')
    const novoSlotEscolhido = novosSlots[0]
    // mensagem em linguagem natural citando o horário oferecido, igual um lead faria
    // (parseBrazilDateTime, não Date direto: o slot é hora local de Brasília sem fuso, "new Date" na hora do
    // servidor interpretaria errado se o servidor não estiver em America/Sao_Paulo)
    const dataEscolhidaFmt = formatDateTimeBR(parseBrazilDateTime(novoSlotEscolhido))
    msg = `Pode ser esse aí mesmo, ${dataEscolhidaFmt}`
    t = await turnoComCalendario(openai, supabase, config, agendaCtx, estado, historico, msg, { reuniaoExistente: eventoAtualFormatado }, eventoAtualId)
    const agendouDeVerdade = t.acao.tipo === 'agendar' && !!t.eventoNovoId
    passos.push({ passo: '2. Escolhe o horário oferecido', lead: msg, sdr: t.blocos.join(' | '), acao: t.acao.tipo, ok: agendouDeVerdade, detalhe: agendouDeVerdade ? `evento novo: ${t.eventoNovoId}` : 'não criou evento novo' })
    if (agendouDeVerdade) {
      // confere no Calendar de verdade que o evento antigo foi cancelado
      const antigoAindaExiste = await getEvent(calendarId, eventoAtualId!, companyId)
      passos.push({ passo: '2b. Confere se o evento antigo foi cancelado de verdade', lead: '(conferência)', sdr: '', acao: '-', ok: antigoAindaExiste === null, detalhe: antigoAindaExiste === null ? 'evento antigo cancelado, confirmado no Calendar' : 'ATENÇÃO: evento antigo ainda existe no Calendar' })
      eventoAtualId = t.eventoNovoId
      eventoAtualFormatado = novoSlotEscolhido
      estado = t.estado
      historico = [...historico, { role: 'user', content: msg }, { role: 'assistant', content: t.blocos.join(' ') }]
    }

    // Passo 3: pede ligação com reunião marcada -> fato da empresa, sem tocar no Calendar
    msg = 'Vocês não podem só me ligar em vez da call?'
    t = await turnoComCalendario(openai, supabase, config, agendaCtx, estado, historico, msg, { reuniaoExistente: eventoAtualFormatado })
    const respondeuFatoOuConfirma = t.acao.tipo !== 'oferecer_ligacao'
    passos.push({ passo: '3. Pede ligação', lead: msg, sdr: t.blocos.join(' | '), acao: t.acao.tipo, ok: respondeuFatoOuConfirma, detalhe: respondeuFatoOuConfirma ? 'não ofereceu outro canal' : 'ofereceu ligação genérica' })
  } finally {
    // Limpeza: cancela o evento que sobrou e apaga o lead/conversa de teste, não fica nada pra trás
    if (eventoAtualId && calendarId) {
      try {
        await cancelEvent(calendarId, eventoAtualId, companyId)
        passos.push({ passo: '4. Limpeza: cancela o evento de teste que sobrou', lead: '(limpeza)', sdr: '', acao: '-', ok: true, detalhe: `evento ${eventoAtualId} cancelado` })
      } catch (err: any) {
        passos.push({ passo: '4. Limpeza: cancela o evento de teste que sobrou', lead: '(limpeza)', sdr: '', acao: '-', ok: false, detalhe: `FALHOU, cancele manualmente o evento ${eventoAtualId}: ${err?.message}` })
      }
    }
    if (conversationId) await supabase.from('sdr_conversation_state').delete().eq('company_id', companyId).eq('conversation_id', conversationId)
    if (leadId) {
      await supabase.from('mensagens_do_whatsapp').delete().eq('id_do_lead', leadId)
      if (conversationId) await supabase.from('conversas_do_whatsapp').delete().eq('id', conversationId)
      await supabase.from('sdr_turn_log').delete().eq('lead_id', leadId)
      await supabase.from('leads').delete().eq('id', leadId)
    }
  }

  return { passos, passou: passos.every((p) => p.ok) }
}
