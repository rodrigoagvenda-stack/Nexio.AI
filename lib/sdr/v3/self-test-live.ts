/**
 * Teste ao vivo dos buracos corrigidos na auditoria do SDR v3 (27/09/2026), contra o modelo de
 * verdade (gpt-4.1), com a config REAL e ativa da empresa. NÃO grava nada: não cria lead, não
 * toca em sdr_conversation_state nem sdr_turn_log, não manda WhatsApp. Chama
 * extrair/decidir/redigir/validar direto, como o turn.ts faria, mas em memória.
 * Usado por scripts/test-sdr-v3-live.ts (CLI) e por app/api/admin/qa/sdr-v3-live (tela admin).
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

const asList = (t: string | string[]) => (Array.isArray(t) ? t : [t])

export interface CenarioResultado {
  nome: string
  lead: string
  sdr: string
  acao: string
  escalou: boolean
  violacoes: string[]
  passou: boolean
  esperado: string
}

async function turno(
  openai: OpenAI,
  config: CompanyConfig,
  estadoIn: Estado,
  historico: MsgHist[],
  mensagemAtual: string,
  ctxParcial: Partial<DecisorCtx>,
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
  const literal = acao.conteudo?.modo === 'literal' ? asList(acao.conteudo.texto) : null
  const soLiteral = !!literal && !acao.reacao_social && !acao.proxima_pergunta
  let blocos: string[]
  if (soLiteral) blocos = literal!
  else {
    const r = await redigir(openai, { config, acao, historico, frasesEnviadas: estado.frases_enviadas })
    blocos = r.blocos
  }
  const violacoes: Violacao[] = validar(blocos, {
    config,
    estado,
    acao,
    mensagensDoLead: [...historico.filter((m) => m.role === 'user').map((m) => m.content), mensagemAtual],
    ultimasNossas: historico.filter((m) => m.role === 'assistant').map((m) => m.content).reverse(),
    eventoConfirmadoNoTurno: false,
  })
  const bloq = violacoes.filter((v) => v.modo === 'bloqueia')
  if (bloq.length > 0) blocos = corrigirMecanico(blocos, { config, estado, acao, mensagensDoLead: [], ultimasNossas: [], eventoConfirmadoNoTurno: false }, bloq)
  return { estado, acao, blocos, extracao, violacoes }
}

export async function runV3LiveSelfTest(companyId = 30): Promise<{ configVersion: number; resultados: CenarioResultado[]; passou: boolean }> {
  const supabase = createServiceClient()
  const cfgRow = await getActiveConfig(companyId, supabase)
  if (!cfgRow) throw new Error(`sem config v3 ativa pra company ${companyId}`)
  const config = cfgRow.config
  const openai = new OpenAI({ apiKey: await resolveOpenAIKey(companyId) })
  const resultados: CenarioResultado[] = []

  const add = (nome: string, esperado: string, cond: (r: Awaited<ReturnType<typeof turno>>) => boolean, r: Awaited<ReturnType<typeof turno>>) => {
    resultados.push({
      nome,
      lead: '',
      sdr: r.blocos.join(' | '),
      acao: r.acao.tipo,
      escalou: !!r.acao.handoff,
      violacoes: r.violacoes.map((v) => `${v.regra}:${v.modo}`),
      passou: cond(r),
      esperado,
    })
  }

  // 0. sanidade: gancho do anúncio na abertura não pode soltar preço/explicação sem pedido
  let mensagem = 'Oi! Vi o anúncio e quero saber por que meu negócio não aparece no Google'
  let r = await turno(openai, config, ESTADO_INICIAL(cfgRow.version), [], mensagem, {})
  resultados.push({ nome: '0. Gancho do anúncio na abertura', lead: mensagem, sdr: r.blocos.join(' | '), acao: r.acao.tipo, escalou: !!r.acao.handoff, violacoes: r.violacoes.map((v) => `${v.regra}:${v.modo}`), passou: r.acao.tipo !== 'responder_como_funciona' && r.acao.tipo !== 'responder_preco', esperado: 'NÃO solta preço nem "como funciona" só pelo gancho do anúncio' })

  const estQualificado: Estado = { ...ESTADO_INICIAL(cfgRow.version), etapa: 'agendado', dados: { nome: 'Marcos', negocio: 'barbearia em Sorocaba', tem_perfil_google: 'sim', escopo: 'gmn', decisor: 'sim' } }
  const histAgendado: MsgHist[] = [{ role: 'assistant', content: 'Marcos, agendado! Quinta às 14h.' }]

  // 1. reunião marcada + pede remarcar/cancelar: escala pro Bruno
  mensagem = 'Poxa, vou ter um imprevisto, não vou poder às 14h, dá pra mudar?'
  r = await turno(openai, config, estQualificado, histAgendado, mensagem, { reuniaoExistente: 'quinta-feira, 01/10, às 14h' })
  resultados.push({ nome: '1. Reunião marcada, lead avisa imprevisto', lead: mensagem, sdr: r.blocos.join(' | '), acao: r.acao.tipo, escalou: !!r.acao.handoff, violacoes: r.violacoes.map((v) => `${v.regra}:${v.modo}`), passou: r.acao.tipo === 'escalar' && !!r.acao.handoff, esperado: 'Escala pro Bruno (não fica só confirmando a reunião velha)' })

  // 2. reunião marcada + lead cita outro horário direto: não pode criar evento duplicado
  mensagem = 'Prefiro sexta às 10h então'
  r = await turno(openai, config, estQualificado, histAgendado, mensagem, { reuniaoExistente: 'quinta-feira, 01/10, às 14h' })
  resultados.push({ nome: '2. Reunião marcada, lead cita outro horário direto', lead: mensagem, sdr: r.blocos.join(' | '), acao: r.acao.tipo, escalou: !!r.acao.handoff, violacoes: r.violacoes.map((v) => `${v.regra}:${v.modo}`), passou: r.acao.tipo !== 'agendar', esperado: 'NÃO agenda de novo (evitaria duplicar evento no Calendar)' })

  // 3. reunião marcada + pede ligação: confirma a reunião, não oferece outro canal
  mensagem = 'Vocês não podem só me ligar em vez da call?'
  r = await turno(openai, config, estQualificado, histAgendado, mensagem, { reuniaoExistente: 'quinta-feira, 01/10, às 14h' })
  resultados.push({ nome: '3. Reunião marcada, lead pede ligação', lead: mensagem, sdr: r.blocos.join(' | '), acao: r.acao.tipo, escalou: !!r.acao.handoff, violacoes: r.violacoes.map((v) => `${v.regra}:${v.modo}`), passou: r.acao.tipo !== 'oferecer_ligacao', esperado: 'Confirma a reunião, não oferece outro canal' })

  // 4. pagamento com escopo desconhecido: pergunta o escopo antes de gerar cobrança
  const estSemEscopo: Estado = { ...ESTADO_INICIAL(cfgRow.version), etapa: 'qualificando', dados: { nome: 'Ana', negocio: 'clínica em Curitiba', tem_perfil_google: 'nao', decisor: 'sim' } }
  mensagem = 'Já quero pagar, manda o link'
  r = await turno(openai, config, estSemEscopo, [], mensagem, { cobrancaAtiva: true })
  resultados.push({ nome: '4. Pede pra pagar sem saber o escopo', lead: mensagem, sdr: r.blocos.join(' | '), acao: r.acao.tipo, escalou: !!r.acao.handoff, violacoes: r.violacoes.map((v) => `${v.regra}:${v.modo}`), passou: r.acao.tipo !== 'gerar_cobranca' && r.blocos.join(' ').toLowerCase().includes('site'), esperado: 'Pergunta o escopo antes (não cobra valor fixo errado)' })

  // 5. qualificação nunca completa sem o escopo
  mensagem = 'Show, então'
  r = await turno(openai, config, estSemEscopo, [], mensagem, {})
  resultados.push({ nome: '5. Qualificação sem escopo não agenda', lead: mensagem, sdr: r.blocos.join(' | '), acao: r.acao.tipo, escalou: !!r.acao.handoff, violacoes: r.violacoes.map((v) => `${v.regra}:${v.modo}`), passou: r.acao.tipo !== 'oferecer_horarios', esperado: 'Tudo respondido menos o escopo: NÃO oferece horário ainda' })

  // 6. voltou depois de encerrado: preço não escala na primeira pergunta
  const estEncerrado: Estado = { ...ESTADO_INICIAL(cfgRow.version), etapa: 'encerrado', pedidos_de_preco: 2, dados: { nome: 'Bruno', negocio: 'padaria em Santos' } }
  mensagem = 'Oi, mudei de ideia, quanto custa mesmo?'
  r = await turno(openai, config, estEncerrado, [{ role: 'assistant', content: 'Entendi! Se mudar de ideia, pode me chamar.' }], mensagem, {})
  resultados.push({ nome: '6. Lead volta depois de ter encerrado, pergunta preço', lead: mensagem, sdr: r.blocos.join(' | '), acao: r.acao.tipo, escalou: !!r.acao.handoff, violacoes: r.violacoes.map((v) => `${v.regra}:${v.modo}`), passou: r.acao.tipo === 'responder_preco', esperado: 'Responde o preço, NÃO escala na primeira pergunta' })

  return { configVersion: cfgRow.version, resultados, passou: resultados.every((x) => x.passou) }
}
