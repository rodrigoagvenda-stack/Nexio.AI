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

export async function turno(
  openai: OpenAI,
  config: CompanyConfig,
  estadoIn: Estado,
  historico: MsgHist[],
  mensagemAtual: string,
  ctxParcial: Partial<DecisorCtx>,
  /** Última mensagem automática (follow, remarketing...) que a empresa mandou antes da resposta do lead. */
  contextoAutomacao?: { origem: string; conteudo: string } | null,
) {
  const extracao = await extrair(openai, { config, estado: estadoIn, historico, mensagemAtual, contextoAutomacao: contextoAutomacao ?? null })
  const ctx: DecisorCtx = {
    temCalendario: true,
    cobrancaAtiva: false,
    primeiraMensagemNossa: historico.length === 0,
    pushName: null,
    contextoOutbound: null,
    origemAnuncio: null,
    reuniaoExistente: null,
    temReuniaoAtiva: !!ctxParcial.reuniaoExistente,
    mensagemLead: mensagemAtual,
    ...ctxParcial,
  }
  const { estado, acao } = decidir(extracao, estadoIn, config, ctx)
  const literal = acao.conteudo?.modo === 'literal' ? asList(acao.conteudo.texto) : null
  const soLiteral = !!literal && !acao.reacao_social && !acao.proxima_pergunta
  let blocos: string[]
  if (soLiteral) blocos = literal!
  else {
    const r = await redigir(openai, { config, acao, historico, frasesEnviadas: estado.frases_enviadas, automacao: contextoAutomacao ?? null })
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

  const estQualificado: Estado = { ...ESTADO_INICIAL(cfgRow.version), etapa: 'agendado', dados: { nome: 'Marcos', negocio: 'barbearia em Sorocaba', tem_perfil_google: 'sim', escopo: 'gmn', decisor: 'sim', email: 'marcos@email.com', nome_completo: 'Marcos Silva' } }
  const histAgendado: MsgHist[] = [{ role: 'assistant', content: 'Marcos, agendado! Quinta às 14h.' }]

  // 1. reunião marcada + pede remarcar sem dizer quando: oferece horários novos, não escala nem fica só confirmando a reunião velha
  mensagem = 'Poxa, vou ter um imprevisto, não vou poder às 14h, dá pra mudar?'
  r = await turno(openai, config, estQualificado, histAgendado, mensagem, { reuniaoExistente: 'quinta-feira, 01/10, às 14h' })
  resultados.push({ nome: '1. Reunião marcada, lead avisa imprevisto', lead: mensagem, sdr: r.blocos.join(' | '), acao: r.acao.tipo, escalou: !!r.acao.handoff, violacoes: r.violacoes.map((v) => `${v.regra}:${v.modo}`), passou: r.acao.tipo === 'oferecer_horarios' || r.acao.tipo === 'escalar', esperado: 'Oferece horários novos pra remarcar (ou escala, nunca só confirma a reunião velha ignorando o imprevisto)' })

  // 2. reunião marcada + lead cita outro horário direto: consulta disponibilidade e segue pra agendar (o turno cancela o evento antigo depois de criar o novo)
  mensagem = 'Prefiro sexta às 10h então'
  r = await turno(openai, config, estQualificado, histAgendado, mensagem, { reuniaoExistente: 'quinta-feira, 01/10, às 14h' })
  resultados.push({ nome: '2. Reunião marcada, lead cita outro horário direto', lead: mensagem, sdr: r.blocos.join(' | '), acao: r.acao.tipo, escalou: !!r.acao.handoff, violacoes: r.violacoes.map((v) => `${v.regra}:${v.modo}`), passou: r.acao.tipo === 'agendar' || r.acao.tipo === 'oferecer_horarios' || r.acao.tipo === 'pedir_dados_agendamento', esperado: 'Consulta o horário pedido e segue o fluxo de agendar (nunca fica preso confirmando só a reunião velha)' })

  // 3. reunião marcada + pede ligação: responde com o fato da empresa (Bruno liga no WhatsApp), não oferece outro canal
  mensagem = 'Vocês não podem só me ligar em vez da call?'
  r = await turno(openai, config, estQualificado, histAgendado, mensagem, { reuniaoExistente: 'quinta-feira, 01/10, às 14h' })
  resultados.push({ nome: '3. Reunião marcada, lead pede ligação', lead: mensagem, sdr: r.blocos.join(' | '), acao: r.acao.tipo, escalou: !!r.acao.handoff, violacoes: r.violacoes.map((v) => `${v.regra}:${v.modo}`), passou: r.acao.tipo !== 'oferecer_ligacao', esperado: 'Confirma a reunião ou explica o fato do Bruno ligar no WhatsApp, não oferece outro canal' })

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

  // ---- Cenários de 05 e 06/10/2026 (leads Rose, Cris, Douglas, Guilherme e Henrique) ----
  // Os marcados "(depende do modelo)" podem variar de uma rodada pra outra: rode mais de uma vez antes de concluir.
  const v = cfgRow.version
  const contadores = ESTADO_INICIAL(v).contadores
  const registrar = (nome: string, lead: string, esperado: string, rr: Awaited<ReturnType<typeof turno>>, passou: boolean) => {
    resultados.push({ nome, lead, sdr: rr.blocos.join(' | '), acao: rr.acao.tipo, escalou: !!rr.acao.handoff, violacoes: rr.violacoes.map((x) => `${x.regra}:${x.modo}`), passou, esperado })
  }
  const textoSdr = (rr: Awaited<ReturnType<typeof turno>>) => rr.blocos.join(' ')
  const histEscopo: MsgHist[] = [{ role: 'assistant', content: 'Para eu entender o seu cenário: o seu foco agora é apenas estruturar e posicionar o seu Google Meu Negócio, ou você também precisa da criação de um site para receber esses clientes?' }]
  const dadosAteDecisor = { nome: 'Henrique', negocio: 'Fechaduras 3H em Valinhos', aparece_no_google: 'nao', tem_perfil_google: 'sim', so_indicacao: 'nao', fez_anuncio: 'sim', impacto_atual: 'nao faz ideia', urgencia: 'pode esperar', decisor: 'sim' }

  // 7. escopo respondido sem pedir valor (Rose): não solta preço
  const estRose: Estado = { ...ESTADO_INICIAL(v), etapa: 'qualificando', turno: 3, dados: { nome: 'Marina', negocio: 'clínica de estética em Belém' }, contadores: { ...contadores, escopo_perguntado: true }, perguntas_feitas: [{ id: 'escopo', turno: 2, respondida: false }] }
  mensagem = 'Só o Google mesmo'
  r = await turno(openai, config, estRose, histEscopo, mensagem, {})
  registrar('7. Escopo respondido sem ter pedido valor (Rose)', mensagem, 'NÃO solta valor (R$); segue a qualificação', r, r.acao.tipo !== 'responder_preco' && !textoSdr(r).includes('R$'))

  // 8. pede valor, responde o escopo (Cris): recebe o valor, sem convite de call no texto fixo
  const estCris: Estado = { ...ESTADO_INICIAL(v), etapa: 'qualificando', turno: 3, dados: { nome: 'Carlos', negocio: 'salão em Belém' } }
  mensagem = 'Qual o valor?'
  r = await turno(openai, config, estCris, [{ role: 'assistant', content: 'Carlos, qual é o seu negócio e em qual cidade você atende?' }, { role: 'user', content: 'Tenho um salão em Belém' }], mensagem, {})
  registrar('8a. Pede valor sem escopo definido (Cris)', mensagem, 'Não passa o valor ainda: pergunta se é só Google Meu Negócio ou também site', r, r.acao.tipo === 'responder_preco' && !textoSdr(r).includes('R$') && textoSdr(r).toLowerCase().includes('site'))
  const estCris2 = r.estado
  mensagem = 'Só o Google'
  r = await turno(openai, config, estCris2, [...histEscopo, { role: 'user', content: 'Qual o valor?' }], mensagem, {})
  registrar('8b. Responde o escopo depois de pedir valor (Cris)', mensagem, 'Recebe o valor do Start (R$ 1.199) mesmo com a qualificação incompleta, sem convite "marcar 15 minutos" no texto fixo', r, r.acao.tipo === 'responder_preco' && textoSdr(r).includes('1.199') && !textoSdr(r).includes('marcar 15 minutos'))

  // 9. valor pedido já com o escopo na mesma frase
  mensagem = 'Quero só o Google Meu Negócio, quanto custa?'
  r = await turno(openai, config, { ...ESTADO_INICIAL(v), etapa: 'qualificando', turno: 3, dados: { nome: 'Ana', negocio: 'clínica em Curitiba' } }, [], mensagem, {})
  registrar('9. Pede valor já dizendo o escopo', mensagem, 'Valor do Start direto (R$ 1.199)', r, r.acao.tipo === 'responder_preco' && textoSdr(r).includes('1.199'))

  // 10. anúncio e Google juntos (Douglas) (depende do modelo)
  mensagem = 'Quanto custa o Google e o tráfego?'
  r = await turno(openai, config, { ...ESTADO_INICIAL(v), etapa: 'qualificando', turno: 3, dados: { nome: 'Douglas', negocio: 'manutenção residencial em Belém' } }, [], mensagem, {})
  registrar('10a. Pergunta valor do Google e de tráfego juntos (Douglas) (depende do modelo)', mensagem, 'Diz que anúncio é personalizado (Bruno na call) e pergunta Google ou site, sem valor ainda', r, r.acao.tipo === 'responder_preco' && !textoSdr(r).includes('R$') && /personaliz/i.test(textoSdr(r)))
  mensagem = 'Já fiz anúncio no Instagram, e qual o valor do Google?'
  r = await turno(openai, config, { ...ESTADO_INICIAL(v), etapa: 'qualificando', turno: 5, dados: { nome: 'Douglas', negocio: 'manutenção residencial em Belém', escopo: 'gmn' } }, [], mensagem, {})
  registrar('10b. Menciona anúncio com escopo Google já escolhido (depende do modelo)', mensagem, 'O escopo continua Google (gmn) e o valor do Start (R$ 1.199) sai; anúncio não manda tudo pro Bruno', r, r.estado.dados.escopo === 'gmn' && textoSdr(r).includes('1.199'))

  // 11. "não entendi" na pergunta pendente (Guilherme)
  const estGuilherme: Estado = { ...ESTADO_INICIAL(v), etapa: 'qualificando', turno: 10, dados: { nome: 'Guilherme', negocio: 'eletricista em Tatuí', aparece_no_google: 'nao', tem_perfil_google: 'sim', so_indicacao: 'nao', fez_anuncio: 'nao', impacto_atual: 'bastante', urgencia: 'pode esperar' }, contadores: { ...contadores, ultimo_id_perguntado: 'decisor' }, perguntas_feitas: [{ id: 'decisor', turno: 9, respondida: false }] }
  const histDecisor: MsgHist[] = [{ role: 'assistant', content: 'Você que decide sobre esse tipo de investimento no seu trabalho ou tem mais alguém envolvido nessa parte?' }]
  mensagem = 'Não entendi'
  r = await turno(openai, config, estGuilherme, histDecisor, mensagem, {})
  registrar('11a. "Não entendi" na pergunta do decisor (Guilherme)', mensagem, 'NÃO escala; pede desculpa e refaz a pergunta em palavras simples', r, !r.acao.handoff && r.acao.tipo === 'perguntar' && /desculp/i.test(textoSdr(r)))
  mensagem = 'beleza'
  r = await turno(openai, config, estGuilherme, histDecisor, mensagem, {})
  registrar('11b. "beleza" como resposta (sem sinal de confusão)', mensagem, 'NÃO pede desculpa por ter confundido', r, !/deixei (meio )?confuso/i.test(textoSdr(r)))
  mensagem = 'Não entendi'
  r = await turno(openai, config, { ...estGuilherme, contadores: { ...estGuilherme.contadores, outros_seguidos: 2 } }, histDecisor, mensagem, {})
  registrar('11c. "Não entendi" pela terceira vez seguida', mensagem, 'Agora escala pro Bruno', r, !!r.acao.handoff)

  // 12. responde o orçamento dizendo que está começando, objeção "retorno imediato" já respondida (Henrique) (depende do modelo)
  const estHenrique: Estado = { ...ESTADO_INICIAL(v), etapa: 'qualificando', turno: 10, dados: dadosAteDecisor, objecoes_respondidas: ['retorno_imediato'], contadores: { ...contadores, ultimo_id_perguntado: 'qualificacao_financeira' } }
  mensagem = 'Ainda não... Como tô no começo, ainda não tenho orçamento definido pra nada, preciso de alguém que entenda de Google pra configurar'
  r = await turno(openai, config, estHenrique, [{ role: 'assistant', content: 'Henrique, você já tem um orçamento reservado pra ajustar essa parte ou ainda não pensou nesse investimento?' }], mensagem, {})
  registrar('12. Responde o orçamento dizendo que está começando (Henrique) (depende do modelo)', mensagem, 'NÃO manda "Quer que eu chame o Bruno aqui?" nem repete a objeção; reconhece a resposta e segue', r, r.acao.tipo !== 'objecao_repetida' && !/chame o Bruno/i.test(textoSdr(r)))

  // 13. recusa de ligação depois dos horários (Henrique)
  const estAgenda: Estado = { ...ESTADO_INICIAL(v), etapa: 'oferta_horario', turno: 12, dados: { ...dadosAteDecisor, orcamento_declarado: 'ainda não tem orçamento definido', escopo: 'gmn' }, contadores: { ...contadores, horarios_ofertados: true } }
  const histHorarios: MsgHist[] = [{ role: 'assistant', content: 'Tenho hoje às 16h, ou amanhã às 11h ou 17h. Qual fica melhor pra você?' }]
  mensagem = 'Ligação não dá, precisa ser por aqui mesmo...'
  r = await turno(openai, config, estAgenda, histHorarios, mensagem, {})
  registrar('13a. Recusa ligação depois dos horários (Henrique)', mensagem, 'Escala pro Bruno conversar por mensagem; NÃO oferece horários de novo', r, !!r.acao.handoff && r.acao.tipo !== 'oferecer_horarios')
  mensagem = 'Pode ser por videochamada, ligação não dá'
  r = await turno(openai, config, estAgenda, histHorarios, mensagem, {})
  registrar('13b. Recusa ligação mas aceita videochamada', mensagem, 'NÃO escala por causa da ligação', r, !r.acao.handoff)
  mensagem = 'Amanhã às 11h fica bom'
  r = await turno(openai, config, estAgenda, histHorarios, mensagem, {})
  registrar('13c. Escolhe um dos horários normalmente', mensagem, 'NÃO escala; segue o agendamento', r, !r.acao.handoff)

  // 14. contesta a mensagem automática do follow (Rose) (depende do modelo)
  const estFollow: Estado = { ...ESTADO_INICIAL(v), etapa: 'qualificando', turno: 3, dados: { nome: 'Rose' } }
  mensagem = 'Não ficou inativa a conversa, o contato está sendo esse o primeiro'
  r = await turno(openai, config, estFollow, [{ role: 'assistant', content: 'Olá, tudo bem? Sou a Laura, atendente do Grupo Venda. Qual o seu nome?' }], mensagem, {}, { origem: 'follow:follow_geral', conteudo: '[Áudio que enviamos, dizia] Oi, tudo bem? Aqui é o Bruno do Grupo Venda. Eu já te mandei mensagem, porém ficou um silêncio total. Eu vou parar de te procurar aqui.' })
  registrar('14. Lead contesta o áudio do follow dizendo que é o primeiro contato (Rose) (depende do modelo)', mensagem, 'Reconhece em uma frase, sem se justificar, e segue a conversa; NÃO escala', r, !r.acao.handoff && r.blocos.length > 0)

  return { configVersion: cfgRow.version, resultados, passou: resultados.every((x) => x.passou) }
}
