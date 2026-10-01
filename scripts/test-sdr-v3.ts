import { GRUPO_VENDA_CONFIG } from '@/lib/sdr/v3/grupo-venda-config'
import { decidir, valorDitoPeloLead, type DecisorCtx } from '@/lib/sdr/v3/decider'
import { chatV3, MODELO_V3, MODELO_V3_FALLBACK } from '@/lib/sdr/v3/extractor'
import { corrigirMecanico, validar } from '@/lib/sdr/v3/validator'
import { validateCompanyConfig } from '@/lib/sdr/v3/config-validate'
import { filtroDisponibilidade, passaFiltro } from '@/lib/sdr/v3/agenda'
import { checarPassos } from '@/lib/sdr/v3/template-check'
import { ESTADO_INICIAL, type Extracao, type Estado } from '@/lib/sdr/v3/types'

// chatV3: rede de segurança do modelo. Sol falhando (nome mudou, indisponível, schema recusado) cai pro
// GPT-4.1 na hora, sem derrubar o turno (achado real, 30/09/2026: troca de modelo sem essa rede arrisca
// parar TUDO de uma vez se o modelo novo não bater 100% com o que o código espera).
async function testarChatV3() {
  let chamadas: string[] = []
  const okClient: any = { chat: { completions: { create: async (p: any) => { chamadas.push(p.model); return { choices: [{ message: { content: '{"ok":true}' } }] } } } } }
  let r = await chatV3(okClient, { messages: [] } as any, 'teste')
  ok('chatV3: modelo principal funcionando, usa só o Sol', chamadas.length === 1 && chamadas[0] === MODELO_V3, JSON.stringify(chamadas))

  chamadas = []
  const falhaUmaVez: any = {
    chat: {
      completions: {
        create: async (p: any) => {
          chamadas.push(p.model)
          if (p.model === MODELO_V3) throw new Error('modelo indisponível')
          return { choices: [{ message: { content: '{"ok":true}' } }] }
        },
      },
    },
  }
  r = await chatV3(falhaUmaVez, { messages: [] } as any, 'teste')
  ok('chatV3: Sol falha, cai pro fallback automaticamente', chamadas.length === 2 && chamadas[0] === MODELO_V3 && chamadas[1] === MODELO_V3_FALLBACK, JSON.stringify(chamadas))
  ok('chatV3: resposta do fallback chega normal, sem derrubar o turno', JSON.parse(r.choices[0]?.message?.content ?? '{}').ok === true)

  const falhaSempre: any = { chat: { completions: { create: async () => { throw new Error('conta sem crédito') } } } }
  let lancou = false
  try {
    await chatV3(falhaSempre, { messages: [] } as any, 'teste')
  } catch {
    lancou = true
  }
  ok('chatV3: os dois modelos falham, propaga o erro (não finge sucesso)', lancou)
}

const config: any = { ...GRUPO_VENDA_CONFIG, version: 3, agendamento: { ativo: true, calendario_id: 'x' } }
let falhas = 0
const ok = (nome: string, cond: boolean, extra = '') => {
  if (!cond) falhas++
  console.log(`${cond ? 'OK   ' : 'FALHA'} ${nome}${extra ? ' :: ' + extra : ''}`)
}
const ex = (p: Partial<Extracao>): Extracao => ({ intencoes: ['outro'], social: null, objecao_id: null, pergunta_fato: null, dados: {}, horario_escolhido: null, tom_do_lead: 'informal', confianca: 'alta', resposta_automatica: false, ...p })
const ctx = (p: Partial<DecisorCtx> = {}): DecisorCtx => ({ temCalendario: true, cobrancaAtiva: false, primeiraMensagemNossa: false, pushName: null, contextoOutbound: null, origemAnuncio: null, reuniaoExistente: null, temReuniaoAtiva: false, mensagemLead: '', ...p })
const est = (p: Partial<Estado> = {}): Estado => ({ ...ESTADO_INICIAL(2), etapa: 'qualificando', ...p })
const txt = (a: any) => [a.conteudo?.texto ?? ''].flat().join('\n')

// 1 abertura com pushName como palpite
let d = decidir(ex({ intencoes: ['social'], social: { tipo: 'cumprimento', texto_do_lead: 'boa tarde, vi o anúncio' } }), ESTADO_INICIAL(2), config, ctx({ primeiraMensagemNossa: true, pushName: 'Carla Souza' }))
ok('abertura pergunta o nome (intro na pergunta)', d.acao.tipo === 'perguntar' && d.acao.proxima_pergunta?.id === 'nome', d.acao.contexto.join(' | '))
ok('abertura: pergunta o nome direto, sem chute a partir do pushName', !d.estado.dados.nome && d.acao.contexto.some((c) => c.includes('Qual o seu nome?')) && !d.acao.contexto.some((c) => c.includes('Carla')))
ok('abertura: reação social ligada', d.acao.reacao_social === true)

// 2 social + resposta
d = decidir(ex({ intencoes: ['social', 'resposta_qualificacao'], social: { tipo: 'retribuicao_pedida', texto_do_lead: 'tô bem e vc?' }, dados: { negocio: 'dentista em Botucatu', segmento: 'dentista', cidade: 'Botucatu' } }), est({ perguntas_feitas: [{ id: 'negocio', turno: 1, respondida: false }], turno: 1 }), config, ctx())
ok('social + resposta: segue para a próxima obrigatória (dor_central)', d.acao.tipo === 'perguntar' && d.acao.proxima_pergunta?.id === 'dor_central', d.acao.proxima_pergunta?.texto)
ok('marca pergunta respondida', d.estado.perguntas_feitas[0].respondida === true)

// 3 preço
d = decidir(ex({ intencoes: ['pergunta_preco'] }), est(), config, ctx())
ok('preço sem escopo: pergunta o escopo em texto fixo (não fala valor)', d.acao.tipo === 'responder_preco' && d.acao.conteudo?.modo === 'literal' && JSON.stringify(d.acao.conteudo.texto).includes('só da configuração do Google Meu Negócio') && !JSON.stringify(d.acao.conteudo.texto).includes('R$') && d.estado.pedidos_de_preco === 1 && d.estado.contadores.escopo_perguntado === true)
ok('preço sem escopo: uma pergunta só (não empilha qualificação)', !d.acao.proxima_pergunta)
d = decidir(ex({ intencoes: ['pergunta_preco'] }), d.estado, config, ctx())
ok('2º pedido de preço escala', d.acao.tipo === 'escalar' && !!d.acao.handoff)

// 4 objeção golpe (literal) e repetida
d = decidir(ex({ intencoes: ['objecao'], objecao_id: 'golpe' }), est(), config, ctx())
ok('golpe é literal com 2 blocos', d.acao.conteudo?.modo === 'literal' && Array.isArray(d.acao.conteudo.texto) && d.acao.conteudo.texto.length === 2)
ok('golpe volta à qualificação', !!d.acao.proxima_pergunta)
d = decidir(ex({ intencoes: ['objecao'], objecao_id: 'golpe' }), d.estado, config, ctx())
ok('objeção repetida', d.acao.tipo === 'objecao_repetida')

// 5 encerrar por orçamento
d = decidir(ex({ intencoes: ['objecao'], objecao_id: 'sem_orcamento' }), est(), config, ctx())
ok('sem orçamento encerra', d.acao.tipo === 'responder_objecao' && d.estado.etapa === 'encerrado')
const dAgr = decidir(ex({ intencoes: ['social'], social: { tipo: 'agradecimento', texto_do_lead: 'obrigado' } }), d.estado, config, ctx())
ok('agradecimento depois de encerrar: frase única', dAgr.acao.tipo === 'agradecimento_fim')

// 6 humano, robô, espera, 2x outro
d = decidir(ex({ intencoes: ['pede_humano'] }), est(), config, ctx())
ok('pede humano escala', d.acao.tipo === 'escalar' && d.estado.etapa === 'escalado')
d = decidir(ex({ intencoes: ['pergunta_se_e_robo'] }), est(), config, ctx())
ok('robô: frase literal + próxima pergunta (spec seção 4, regra 2 "depois segue")', d.acao.tipo === 'responder_identidade' && d.acao.conteudo?.modo === 'literal' && !!d.acao.proxima_pergunta)
d = decidir(ex({ intencoes: ['pede_espera'] }), est(), config, ctx())
ok('pede espera: aguardar sem pergunta', d.acao.tipo === 'aguardar' && !d.acao.proxima_pergunta)
let e2 = decidir(ex({ intencoes: ['outro'] }), est(), config, ctx())
e2 = decidir(ex({ intencoes: ['outro'] }), e2.estado, config, ctx())
ok('"outro" 2x seguidas escala', e2.acao.tipo === 'escalar')

// 7 qualificação completa e agendamento
const completo = est({ dados: { negocio: 'dentista', aparece_no_google: 'nao', tem_perfil_google: 'sim', so_indicacao: 'nao', fez_anuncio: 'nao', impacto_atual: 'perde clientes toda semana', urgencia: 'sim', decisor: 'sim', orcamento_declarado: 'sim, tenho orçamento pra isso', escopo: 'gmn' } })
d = decidir(ex({ intencoes: ['outro'] }), completo, config, ctx())
ok('qualificação completa oferece horários', d.acao.tipo === 'oferecer_horarios')
d = decidir(ex({ intencoes: ['quer_agendar'] }), est({ dados: { negocio: 'x' } }), config, ctx())
ok('quer agendar sem qualificação: NÃO oferece horário, pergunta', d.acao.tipo === 'perguntar' && !!d.acao.proxima_pergunta, d.acao.tipo)

// 7a oferta de horário: sem disco riscado, filtro do lead, limite
const jaOfertou = est({ ...completo, etapa: 'oferta_horario', contadores: { ...completo.contadores, horarios_ofertados: true, ofertas_horario: 1 }, dados: { ...completo.dados, _slots: '2026-10-01T09:00:00' } })
d = decidir(ex({ intencoes: ['social'], social: { tipo: 'cumprimento', texto_do_lead: 'ok' } }), jaOfertou, config, ctx())
ok('horários já enviados + lead só diz "ok": pergunta se algum serve, não reenvia a lista', d.acao.tipo === 'perguntar' && d.acao.proxima_pergunta?.id === 'horario', d.acao.tipo)
d = decidir(ex({ intencoes: ['resposta_qualificacao'], dados: { disponibilidade: 'de manhã não dá' } }), jaOfertou, config, ctx())
ok('lead diz "de manhã não dá": reoferece (com filtro no turno)', d.acao.tipo === 'oferecer_horarios', d.acao.tipo)
d = decidir(ex({ intencoes: ['resposta_qualificacao'], dados: { disponibilidade: 'sexta não' } }), { ...jaOfertou, contadores: { ...jaOfertou.contadores, ofertas_horario: 3 } }, config, ctx())
ok('3 listas de horário sem escolha: vai pra pessoa', d.acao.tipo === 'escalar', d.acao.tipo)
const lembrado = { ...jaOfertou, perguntas_feitas: [{ id: 'horario', turno: 1, respondida: false }, { id: 'horario', turno: 2, respondida: false }] }
d = decidir(ex({ intencoes: ['social'] }), lembrado, config, ctx())
ok('lembrado 2x sem escolher: vai pra pessoa', d.acao.tipo === 'escalar', d.acao.tipo)
d = decidir(ex({ intencoes: ['pede_espera'] }), jaOfertou, config, ctx())
ok('horários enviados + "vou ver minha agenda": aguarda', d.acao.tipo === 'aguardar', d.acao.tipo)
{
  const f1 = filtroDisponibilidade('de manhã não dá')
  ok('filtro: "de manhã não dá" tira manhã', !!f1 && !f1.periodos.includes('manha') && f1.periodos.includes('tarde'))
  const f2 = filtroDisponibilidade('só à tarde')
  ok('filtro: "só à tarde" deixa só tarde', !!f2 && f2.periodos.join() === 'tarde')
  const f3 = filtroDisponibilidade('depois das 18h')
  ok('filtro: "depois das 18h"', f3?.depoisDe === 18)
  ok('filtro: sem restrição devolve null', filtroDisponibilidade('qualquer horário') === null)
  const hojeIso = '2026-10-01', amanhaIso = '2026-10-02'
  ok('filtro aplica: 9h fora quando manhã não dá', !passaFiltro(new Date('2026-10-02T09:00:00-03:00'), f1, hojeIso, amanhaIso))
  ok('filtro aplica: 14h passa quando manhã não dá', passaFiltro(new Date('2026-10-02T14:00:00-03:00'), f1, hojeIso, amanhaIso))
  ok('filtro aplica: "hoje não" tira hoje', !passaFiltro(new Date('2026-10-01T15:00:00-03:00'), filtroDisponibilidade('hoje não consigo'), hojeIso, amanhaIso))
}

// preço já enviado pro mesmo escopo: lembrete curto, não o texto inteiro de novo (conv 530)
if (config.preco.por_escopo) {
  const pe = config.preco.por_escopo
  const op = pe.opcoes[0]
  const comEscopo = est({ dados: { [pe.campo]: op.valor }, contadores: { ...ESTADO_INICIAL(2).contadores, escopo_perguntado: true } })
  let p1 = decidir(ex({ intencoes: ['pergunta_preco'] }), comEscopo, config, ctx())
  ok('1º pedido de preço: texto literal inteiro', p1.acao.tipo === 'responder_preco' && p1.acao.conteudo?.modo === 'literal')
  p1 = decidir(ex({ intencoes: ['pergunta_preco'] }), p1.estado, config, ctx())
  ok('2º pedido, mesmo escopo: lembrete curto (livre)', p1.acao.tipo === 'responder_preco' && p1.acao.conteudo?.modo === 'livre', p1.acao.tipo)
  const outra = pe.opcoes[1]
  if (outra) {
    p1 = decidir(ex({ intencoes: ['pergunta_preco'], dados: { [pe.campo]: outra.valor } }), { ...p1.estado, pedidos_de_preco: 0 }, config, ctx())
    ok('escopo mudou: manda o valor novo inteiro', p1.acao.conteudo?.modo === 'literal', p1.acao.tipo)
  }
}

// 7a-bug: escolheu horário + perguntou como funciona na mesma mensagem: agendamento tem prioridade sobre
// como_funciona/preço, não pode virar explicação de novo com pergunta de qualificação colada por cima
// (achado real, lead Simone/conv923, 30/09/2026)
{
  const simone = est({ dados: { negocio: 'turismo', aparece_no_google: 'nao', tem_perfil_google: 'sim', so_indicacao: 'nao', fez_anuncio: 'nao', impacto_atual: 'perde clientes', urgencia: 'sim', decisor: 'sim', orcamento_declarado: 'sim, tenho orçamento pra isso', escopo: 'gmn' }, etapa: 'oferta_horario', contadores: { ...ESTADO_INICIAL(2).contadores, horarios_ofertados: true } })
  const d = decidir(ex({ intencoes: ['escolheu_horario', 'pergunta_como_funciona'], horario_escolhido: '2026-10-01T17:00:00' }), simone, config, ctx())
  ok('escolheu horário + "como funciona" junto: prioriza o agendamento, não reabre como_funciona', d.acao.tipo === 'pedir_dados_agendamento', d.acao.tipo)
  ok('não cola pergunta de qualificação (ex.: impacto) no meio disso', !d.acao.proxima_pergunta, JSON.stringify(d.acao.proxima_pergunta))
}

// 7a'' comentário curto: oferece a chance em TODA resposta de qualificação, não numa contagem cega a cada 2
// (achado real, lead Willian/conv944, 30/09/2026: a contagem cega caiu num turno sem comentário bem na hora em
// que ele disse "Tenho Google ads", e a pergunta seguinte soou como se tivesse ignorado isso). O redator (que
// vê a mensagem real do lead) decide se tem algo que mereça reconhecer ou se é só um "sim"/"não" seco.
{
  const feitas = [{ id: config.qualificacao.perguntas[0].id, turno: 1, respondida: true }, { id: config.qualificacao.perguntas[1].id, turno: 2, respondida: false }]
  const campo2 = config.qualificacao.perguntas[1].campo
  d = decidir(ex({ intencoes: ['resposta_qualificacao'], dados: { [campo2]: 'dentista' } }), est({ perguntas_feitas: feitas, turno: 3 }), config, ctx())
  ok('2ª resposta: oferece comentário curto antes da próxima pergunta', d.acao.contexto.some((c) => c.includes('comentário curto')), d.acao.contexto.join(' | '))
  d = decidir(ex({ intencoes: ['resposta_qualificacao'], dados: { [config.qualificacao.perguntas[0].campo]: 'x' } }), est({ perguntas_feitas: [{ ...feitas[0], respondida: false }], turno: 2 }), config, ctx())
  ok('1ª resposta: também oferece comentário curto (não é mais numa contagem cega a cada 2)', d.acao.contexto.some((c) => c.includes('comentário curto')), d.acao.contexto.join(' | '))
}
// 7a''' templates de automação passam pelo validador ao salvar (spec seção 6)
ok('template com palavra proibida bloqueia', !!checarPassos([{ mensagem: 'A análise é gratuita, sem compromisso' }], config))
ok('template com palavra proibida no pool bloqueia', !!checarPassos([{ mensagem: null, pool_mensagens: [{ texto: 'é grátis' }] }], config))
ok('template limpo passa', checarPassos([{ mensagem: '{nome}, conseguiu ver minha última mensagem?' }], config) === null)
ok('template com R$ bloqueia quando a empresa não informa preço', !!checarPassos([{ mensagem: 'Sai por R$ 1.125' }], { ...config, preco: { ...config.preco, pode_informar: false } }))

// 7a' resposta automática da empresa do lead: não responde (robô com robô)
d = decidir(ex({ intencoes: ['social'], resposta_automatica: true }), est(), config, ctx())
ok('resposta automática sem conteúdo: silêncio', d.acao.tipo === 'aguardar' && d.acao.silencio === true, d.acao.tipo)
d = decidir(ex({ intencoes: ['resposta_qualificacao'], resposta_automatica: true, dados: { negocio: 'clínica de estética' } }), est(), config, ctx())
ok('marcado automático mas trouxe dado do negócio: responde normal', !d.acao.silencio, d.acao.tipo)

// 7b já existe reunião marcada: nunca reabre qualificação (caso do lead que confirma presença no lembrete de anti no-show, mesmo com campo obrigatório faltando)
d = decidir(ex({ intencoes: ['social'], social: { tipo: 'retribuicao_pedida', texto_do_lead: 'Sim' } }), est({ dados: { decisor: 'sim' } }), config, ctx({ reuniaoExistente: 'quinta-feira, 01/10, às 14h' }))
ok('reunião já marcada: confirma a reunião em vez de perguntar o que falta', d.acao.tipo === 'responder_fato' && d.acao.fatos.some((f) => f.id === 'reuniao_existente') && !d.acao.proxima_pergunta, d.acao.tipo)
d = decidir(ex({ intencoes: ['pede_remarcar'] }), est(), config, ctx({ reuniaoExistente: 'quinta-feira, 01/10, às 14h' }))
ok('reunião já marcada + pede remarcar sem dizer quando: oferece horários novos (não escala, não fica só confirmando a reunião velha)', d.acao.tipo === 'oferecer_horarios', d.acao.tipo)
const jaTinhaDadosDeAgendamento = { ...completo, dados: { ...completo.dados, email: 'marcos@email.com', nome_completo: 'Marcos Silva' } }
d = decidir(ex({ intencoes: ['escolheu_horario'], horario_escolhido: '2026-10-05T10:00:00' }), jaTinhaDadosDeAgendamento, config, ctx({ reuniaoExistente: 'quinta-feira, 01/10, às 14h' }))
ok('reunião já marcada + lead cita outro horário direto (já tinha e-mail/nome de antes): segue pra agendar (o turno cancela o evento antigo depois de criar o novo)', d.acao.tipo === 'agendar', d.acao.tipo)
d = decidir(ex({ intencoes: ['pede_ligacao'] }), est(), config, ctx({ reuniaoExistente: 'quinta-feira, 01/10, às 14h' }))
ok('reunião já marcada + pede ligação: responde com o fato da empresa (Bruno liga no WhatsApp), não oferece outro canal', d.acao.tipo === 'responder_fato' && d.acao.fatos.some((f) => f.id === 'reuniao_ligacao'), d.acao.tipo)
const cfgSemFatoLigacao: any = { ...config, ligacao: { ...config.ligacao, reuniao_e_ligacao: undefined } }
d = decidir(ex({ intencoes: ['pede_ligacao'] }), est(), cfgSemFatoLigacao, ctx({ reuniaoExistente: 'quinta-feira, 01/10, às 14h' }))
ok('reunião já marcada + pede ligação, empresa sem esse fato configurado: confirma a reunião (nunca inventa como funciona)', d.acao.tipo === 'responder_fato' && d.acao.fatos.some((f) => f.id === 'reuniao_existente'), d.acao.tipo)

// regressão real (lead Rodrigo Evangelista/63104, 28/09): "quero cancelar" era tratado como pede_remarcar
// (só oferecia novo horário) e, insistindo, como "recusa" — a conversa encerrava sem cancelar o evento real.
d = decidir(ex({ intencoes: ['cancela_reuniao'] }), est(), config, ctx({ reuniaoExistente: 'quinta-feira, 01/10, às 14h', temReuniaoAtiva: true }))
ok('reunião já marcada + pede pra cancelar: cancela de verdade (não oferece horário, não trata como objeção)', d.acao.tipo === 'cancelar_reuniao', d.acao.tipo)
d = decidir(ex({ intencoes: ['cancela_reuniao', 'recusa'] }), est(), config, ctx({ reuniaoExistente: 'quinta-feira, 01/10, às 14h', temReuniaoAtiva: true }))
ok('cancelamento vem junto com "recusa" (lead insistindo): cancela mesmo assim, recusa não sequestra o turno', d.acao.tipo === 'cancelar_reuniao', d.acao.tipo)
d = decidir(ex({ intencoes: ['cancela_reuniao', 'escolheu_horario'], horario_escolhido: '2026-10-03T10:00:00' }), est(), config, ctx({ reuniaoExistente: 'quinta-feira, 01/10, às 14h', temReuniaoAtiva: true }))
ok('cancela e já escolhe novo horário na mesma mensagem: é remarcação, não cancelamento puro', d.acao.tipo !== 'cancelar_reuniao', d.acao.tipo)
d = decidir(ex({ intencoes: ['cancela_reuniao'] }), est(), config, ctx({ reuniaoExistente: null, temReuniaoAtiva: false }))
ok('pede pra cancelar sem ter reunião marcada: não dispara a ação de cancelar (nada pra cancelar)', d.acao.tipo !== 'cancelar_reuniao', d.acao.tipo)
// Bug real (28/09, segunda causa): lead pediu pra cancelar DEPOIS do horário marcado já ter passado (09:46, reunião
// das 09:30). reuniaoExistente só conta horário futuro (null aqui), mas o evento real ainda existe: tem que cancelar.
d = decidir(ex({ intencoes: ['cancela_reuniao'] }), est(), config, ctx({ reuniaoExistente: null, temReuniaoAtiva: true }))
ok('pede pra cancelar depois do horário já ter passado (evento ainda existe): cancela de verdade', d.acao.tipo === 'cancelar_reuniao', d.acao.tipo)

// regressão real (lead Mike/63473, 28/09): respondeu "Tá okay obrigado" ao áudio final do follow ("vou parar de te
// procurar") e o SDR, sem saber que era resposta a uma automação, voltou a perguntar nome/ramo/cidade da empresa.
const emQualificacao = est({ dados: { nome: 'Mike' }, perguntas_feitas: [{ id: 'negocio', turno: 2, respondida: false }], turno: 2 })
d = decidir(ex({ intencoes: ['social'], social: { tipo: 'agradecimento', texto_do_lead: 'Tá okay obrigado' } }), emQualificacao, config, ctx({ respondendoAutomacao: true }))
ok('agradece em resposta a uma automação (follow): só fecha educado, não volta a perguntar qualificação', d.acao.tipo === 'agradecimento_fim' && !d.acao.proxima_pergunta, d.acao.tipo)
d = decidir(ex({ intencoes: ['social'], social: { tipo: 'agradecimento', texto_do_lead: 'Tá okay obrigado' } }), emQualificacao, config, ctx({ respondendoAutomacao: false }))
ok('agradece SEM ser resposta a automação, conversa normal de qualificação: comportamento de antes (segue perguntando)', d.acao.tipo === 'perguntar', d.acao.tipo)
d = decidir(ex({ intencoes: ['recusa'] }), emQualificacao, config, ctx({ respondendoAutomacao: true }))
ok('recusa em resposta a automação (follow/remarketing/promoção): encerra na hora e vira Perdido, sem objeção repetida', d.acao.tipo === 'encerrar' && d.estado.etapa === 'encerrado', d.acao.tipo)
d = decidir(ex({ intencoes: ['recusa', 'pergunta_preco'] }), emQualificacao, config, ctx({ respondendoAutomacao: true }))
ok('recusa junto com pergunta de preço em resposta a automação: NÃO encerra (ele ainda quer saber algo)', d.acao.tipo !== 'encerrar', d.acao.tipo)
d = decidir(ex({ intencoes: ['resposta_qualificacao'], dados: { negocio: 'Barbearia em Campinas' } }), emQualificacao, config, ctx({ respondendoAutomacao: true }))
ok('responde de verdade (interesse) a uma automação: segue o fluxo normal, não encerra', d.acao.tipo !== 'encerrar' && d.acao.tipo !== 'agradecimento_fim', d.acao.tipo)
d = decidir(ex({ intencoes: ['escolheu_horario', 'informou_email'], horario_escolhido: '2026-10-01T14:00:00', dados: { email: 'a@b.com', nome_completo: 'Ana Souza' } }), completo, config, ctx())
ok('horário + e-mail + nome completo: agendar', d.acao.tipo === 'agendar')
d = decidir(ex({ intencoes: ['escolheu_horario'], horario_escolhido: '2026-10-01T14:00:00' }), completo, config, ctx())
ok('horário sem e-mail: pede dados', d.acao.tipo === 'pedir_dados_agendamento')

// 7e regressão real (lead Cícero, 27/09): escolheu_horario chega no MESMO turno que outra intenção de
// prioridade maior (como funciona) e some sem deixar rastro; turnos seguintes, sem repetir a escolha,
// caem num loop de reoferecer os mesmos horários pra sempre em vez de pedir o que falta.
d = decidir(ex({ intencoes: ['escolheu_horario', 'pergunta_como_funciona'], horario_escolhido: '2026-09-28T15:00:00' }), completo, config, ctx())
ok('horário + como funciona no mesmo turno: horário não se perde (fica salvo em dados)', d.estado.dados.horario_escolhido === '2026-09-28T15:00:00', JSON.stringify(d.estado.dados))
const comHorarioPendente = { ...d.estado }
d = decidir(ex({ intencoes: ['social'] }), comHorarioPendente, config, ctx())
ok('turno seguinte sem repetir a escolha: NÃO reoferece horários de novo (pede o que falta)', d.acao.tipo === 'pedir_dados_agendamento', d.acao.tipo)
d = decidir(ex({ intencoes: ['outro'], dados: { email: 'cicero@teste.com', nome_completo: 'Cícero Silva' } }), comHorarioPendente, config, ctx())
ok('turno seguinte com e-mail e nome completo já preenchidos: fecha o agendamento sem precisar repetir escolheu_horario', d.acao.tipo === 'agendar', d.acao.tipo)

// 7f regressão real (lead Marcelo, 27/09): pergunta obrigatória (escopo) feita 2x sem resposta reconhecível
// — o motor desistia de perguntar de novo e nunca mais tentava, nem avisava ninguém, ficando preso pra sempre.
const escopoTravado = est({
  dados: { negocio: 'Guincho', aparece_no_google: 'nao', tem_perfil_google: 'sim', so_indicacao: 'nao', fez_anuncio: 'nao', impacto_atual: 'perde clientes', urgencia: 'sim', decisor: 'sim', orcamento_declarado: 'sim, tenho orçamento pra isso' },
  perguntas_feitas: [
    { id: 'escopo', turno: 4, respondida: false },
    { id: 'escopo', turno: 6, respondida: false },
  ],
  turno: 6,
})
d = decidir(ex({ intencoes: ['pergunta_fato'], pergunta_fato: 'Você podia fazer uma análise?' }), escopoTravado, config, ctx())
ok('pergunta obrigatória travada 2x: escala (handoff) mesmo respondendo a dúvida do turno', d.acao.tipo === 'responder_fato' && !!d.acao.handoff, JSON.stringify(d.acao.handoff))
d = decidir(ex({ intencoes: ['social'], social: { tipo: 'cumprimento', texto_do_lead: 'oi' } }), escopoTravado, config, ctx())
ok('pergunta obrigatória travada 2x, turno sem nada relevante: aguarda mas ainda assim escala', d.acao.tipo === 'aguardar' && !!d.acao.handoff, JSON.stringify(d.acao))
const escopoUmaVez = est({
  dados: { negocio: 'Guincho', aparece_no_google: 'nao', tem_perfil_google: 'sim', so_indicacao: 'nao', fez_anuncio: 'nao', impacto_atual: 'perde clientes', urgencia: 'sim', decisor: 'sim', orcamento_declarado: 'sim, tenho orçamento pra isso' },
  perguntas_feitas: [{ id: 'escopo', turno: 4, respondida: false }],
  turno: 6,
})
d = decidir(ex({ intencoes: ['pergunta_fato'], pergunta_fato: 'Você podia fazer uma análise?' }), escopoUmaVez, config, ctx())
ok('pergunta obrigatória feita só 1x ainda: NÃO escala (ainda tem tentativa)', !d.acao.handoff, JSON.stringify(d.acao.handoff))

// regressão real (lead Rodrigo/conv530, 30/09/2026): depois de escalar 1x por pergunta travada, nada desistia
// dela — toda vez que o resto do funil terminava de novo (outras respostas chegando normal), a MESMA trava
// disparava handoff de novo, pausando a conversa repetidamente pro sempre a cada novo turno.
{
  d = decidir(ex({ intencoes: ['pergunta_fato'], pergunta_fato: 'Você podia fazer uma análise?' }), escopoTravado, config, ctx())
  ok('escalou 1x: desiste do campo travado (marca preenchido, não fica pra sempre com buraco)', d.estado.dados.escopo === '(sem resposta)', d.estado.dados.escopo)
  // próximo turno, com o estado já "desistido": mesmo sem o lead ter respondido nada de novo, NÃO escala de novo
  const d2 = decidir(ex({ intencoes: ['social'], social: { tipo: 'cumprimento', texto_do_lead: 'oi' } }), d.estado, config, ctx())
  ok('turno seguinte, mesmo buraco: NÃO escala de novo (já desistiu, já avisou 1x)', !d2.acao.handoff, JSON.stringify(d2.acao.handoff))
}

// pergunta_fato NÃO cola a próxima pergunta de qualificação por cima (achado real, 01/10/2026: lead
// perguntou "quais serviços tem?", recebeu a resposta certa e já veio a próxima pergunta colada na mesma
// respirada, sem pausa — parece bot). Responde só o que foi perguntado; a qualificação segue no turno seguinte.
d = decidir(ex({ intencoes: ['pergunta_fato'], pergunta_fato: 'Quais serviços vocês têm?' }), est({ dados: { negocio: 'dentista' } }), config, ctx())
ok('pergunta_fato: responde sem colar a próxima pergunta do roteiro', d.acao.tipo === 'responder_fato' && !d.acao.proxima_pergunta, JSON.stringify(d.acao.proxima_pergunta))

// 7g objeção classificada mas sem id reconhecido na lista configurada: antes era ignorada em silêncio
d = decidir(ex({ intencoes: ['objecao'], objecao_id: null }), est(), config, ctx())
ok('objeção sem id reconhecido: escala em vez de ignorar', d.acao.tipo === 'escalar_duvida', d.acao.tipo)

// 7g2 objecao_id preenchido mas SEM a tag "objecao" na lista de intenções (achado real, lead Roberto/conv941,
// 30/09/2026: a IA reconheceu "tem uma agência que cuida das otimizações" = ja_uso_outra_coisa, mas esqueceu
// de marcar objecao em intencoes; a regra inteira era pulada e o lead seguia pro roteiro como se não tivesse
// dito nada relevante). objecao_id sozinho já precisa disparar a regra.
d = decidir(ex({ intencoes: ['resposta_qualificacao'], objecao_id: 'ja_uso_outra_coisa' }), est(), config, ctx())
ok('objecao_id preenchido sem a tag "objecao": ainda assim responde a objeção', d.acao.tipo === 'responder_objecao', d.acao.tipo)

d = decidir(ex({ intencoes: ['pede_pagamento'] }), est(), config, ctx())
ok('pagamento sem cobrança ativa escala', d.acao.tipo === 'escalar')
d = decidir(ex({ intencoes: ['pede_pagamento'] }), est({ dados: { nome: 'Ana' } }), config, ctx({ cobrancaAtiva: true }))
ok('pagamento com cobrança ativa mas escopo desconhecido: pergunta o escopo antes (nunca cobra valor fixo errado)', d.acao.tipo === 'perguntar' && txt(d.acao).includes('site também'), d.acao.tipo)
d = decidir(ex({ intencoes: ['pede_pagamento'] }), est({ dados: { escopo: 'site' } }), config, ctx({ cobrancaAtiva: true }))
ok('pagamento com escopo já conhecido: segue pro CPF/CNPJ normalmente', d.acao.tipo === 'perguntar' && d.acao.proxima_pergunta?.id === 'cpf_cnpj', d.acao.tipo)

// 7c qualificação nunca completa sem o escopo (Start ou Essencial)
d = decidir(ex({ intencoes: ['outro'] }), est({ dados: { negocio: 'dentista', tem_perfil_google: 'sim', decisor: 'sim' } }), config, ctx())
ok('sem escopo: qualificação NÃO está completa, não oferece horário', d.acao.tipo !== 'oferecer_horarios', d.acao.tipo)

// 7d volta depois de encerrar: preço e objeções recomeçam do zero (senão a 1ª pergunta de preço no retorno já escala)
const encerradoComHistorico = est({ etapa: 'encerrado', pedidos_de_preco: 2, objecoes_respondidas: ['caro'] })
d = decidir(ex({ intencoes: ['social'], social: { tipo: 'cumprimento', texto_do_lead: 'Oi, voltei' } }), encerradoComHistorico, config, ctx())
ok('volta depois de encerrar: zera pedidos de preço', d.estado.pedidos_de_preco === 0)
ok('volta depois de encerrar: zera objeções já respondidas', d.estado.objecoes_respondidas.length === 0)

function regrasPrime(b: string[]) { return validar(b, { config, estado: est(), acao: { tipo: 'perguntar', conteudo: null, fatos: [], proxima_pergunta: null, contexto: [] } as any, mensagensDoLead: [], ultimasNossas: [], eventoConfirmadoNoTurno: false }).map((x) => `${x.regra}:${x.modo}`).join(',') }
// 7b como funciona e preço por escopo (Start e Essencial; Prime nunca aparece)
d = decidir(ex({ intencoes: ['pergunta_preco', 'pergunta_como_funciona'] }), est({ dados: { nome: 'Luciano' } }), config, ctx())
ok('como funciona: texto fixo, chama pelo nome', d.acao.tipo === 'responder_como_funciona' && d.acao.conteudo?.modo === 'literal' && txt(d.acao).startsWith('Luciano, a gente cuida'), txt(d.acao).slice(0, 60))
ok('como funciona sem escopo: termina perguntando o escopo e não empilha outra pergunta', txt(d.acao).trim().endsWith('ou precisa de um site também?') && !d.acao.proxima_pergunta && d.estado.contadores.escopo_perguntado === true)
ok('como funciona não solta valor antes de saber o escopo', !txt(d.acao).includes('R$'))
const dComoSemNome = decidir(ex({ intencoes: ['pergunta_como_funciona'] }), est(), config, ctx())
ok('como funciona sem nome conhecido: sem buraco no texto', txt(dComoSemNome.acao).startsWith('A gente cuida da presença digital'), txt(dComoSemNome.acao).slice(0, 50))
const aposComo = d.estado
d = decidir(ex({ intencoes: ['resposta_qualificacao'], dados: { escopo: 'gmn' } }), aposComo, config, ctx())
ok('escopo gmn (depois de perguntado): sai o Start, Pix e 3x sem juros', d.acao.tipo === 'responder_preco' && txt(d.acao).includes('R$ 1.199') && txt(d.acao).includes('3x de R$ 399,67') && txt(d.acao).includes('sem juros'), txt(d.acao).slice(0, 80))
ok('escopo gmn: não fala do site nem do Prime', !/2\.200|\bprime\b/i.test(txt(d.acao)))
d = decidir(ex({ intencoes: ['resposta_qualificacao'], dados: { escopo: 'site' } }), aposComo, config, ctx())
ok('escopo site: sai o Essencial, 2.200 no Pix e 6x com juros', txt(d.acao).includes('R$ 2.200') && txt(d.acao).includes('6x de R$ 397,03') && txt(d.acao).includes('com juros') && !/prime/i.test(txt(d.acao)))
d = decidir(ex({ intencoes: ['pergunta_preco'] }), est({ dados: { escopo: 'gmn' } }), config, ctx())
ok('preço com escopo já conhecido: responde direto', d.acao.tipo === 'responder_preco' && txt(d.acao).includes('R$ 1.199'))
d = decidir(ex({ intencoes: ['pergunta_preco', 'pergunta_como_funciona'] }), est({ dados: { escopo: 'site' } }), config, ctx())
ok('valor + como funciona com escopo conhecido: explica e já dá o valor, sem re-perguntar', txt(d.acao).toLowerCase().includes('a gente cuida da presença digital') && txt(d.acao).includes('R$ 2.200') && !txt(d.acao).includes('ou precisa de um site também?'))
d = decidir(ex({ intencoes: ['pergunta_preco'] }), est({ dados: { nome: 'Ana' }, pedidos_de_preco: 1, contadores: { ...ESTADO_INICIAL(3).contadores, escopo_perguntado: true } }), config, ctx())
ok('insistiu no valor sem responder o escopo: chama o Bruno (não fica sem resposta)', d.acao.tipo === 'escalar')
ok('escopo dito sem ninguém ter perguntado: só guarda, não solta valor', decidir(ex({ intencoes: ['resposta_qualificacao'], dados: { escopo: 'gmn' } }), est(), config, ctx()).acao.tipo !== 'responder_preco')

// preço com CTA de agendamento embutido na config (Rodrigo, 30/09/2026): o texto já termina em "?", então
// NUNCA cola uma pergunta de qualificação por cima, mesmo com qualificação incompleta
{
  const p = decidir(ex({ intencoes: ['resposta_qualificacao'], dados: { escopo: 'gmn' } }), aposComo, config, ctx())
  ok('preço com CTA: termina no CTA, sem pergunta de qualificação colada', txt(p.acao).trim().endsWith('?') && !p.acao.proxima_pergunta, JSON.stringify(p.acao.proxima_pergunta))
  ok('preço com CTA: convida a marcar 15 minutos', txt(p.acao).includes('topa marcar 15 minutos'))
}

// trava de orçamento (encerrar_se_nao): "não" claro na pergunta de qualificação financeira encerra na hora,
// uma vez só; resposta ambígua não conta; depois de encerrado não reabre sozinho por causa do mesmo campo.
{
  const cfgFin: any = { ...config, qualificacao: { perguntas: [...config.qualificacao.perguntas, { id: 'orcamento', ordem: 99, obrigatoria: true, campo: 'orcamento_ok', campo_tipo: 'sim_nao', texto: 'Nosso mínimo é R$ 1.199, faz sentido pra você?', encerrar_se_nao: 'Poxa {nome}, no momento não consigo te ajudar.' }] } }
  let d1 = decidir(ex({ intencoes: ['resposta_qualificacao'], dados: { orcamento_ok: 'nao' } }), est({ dados: { nome: 'Marcos' } }), cfgFin, ctx())
  ok('respondeu "não" no orçamento: encerra na hora', d1.acao.tipo === 'encerrar' && d1.estado.etapa === 'encerrado', d1.acao.tipo)
  ok('frase de encerramento usa o nome', txt(d1.acao).includes('Marcos'))
  d1 = decidir(ex({ intencoes: ['social'] }), d1.estado, cfgFin, ctx())
  ok('turno seguinte, campo continua "nao": NÃO reabre encerrar de novo sozinho', d1.acao.tipo !== 'encerrar', d1.acao.tipo)
  const d2 = decidir(ex({ intencoes: ['resposta_qualificacao'], dados: { orcamento_ok: 'nao sei' } }), est({ dados: { nome: 'Marcos' } }), cfgFin, ctx())
  ok('resposta ambígua ("não sei") não conta como recusa', d2.acao.tipo !== 'encerrar', d2.acao.tipo)
}

// trava de orçamento sem ancoragem (valor_minimo_aceitavel, Rodrigo 30/09/2026): pergunta aberta, sem falar
// valor; só corta quando o PRÓPRIO lead diz um número abaixo do mínimo.
{
  ok('valorDitoPeloLead: "uns 200" pega 200', valorDitoPeloLead('uns 200') === 200)
  ok('valorDitoPeloLead: "tenho 2 mil separados" pega 2000', valorDitoPeloLead('tenho 2 mil separados') === 2000)
  ok('valorDitoPeloLead: "consigo uns 800 por mês" pega 800', valorDitoPeloLead('consigo uns 800 por mês') === 800)
  ok('valorDitoPeloLead: "R$1.199,00" pega 1199', valorDitoPeloLead('consigo pagar R$1.199,00') === 1199)
  ok('valorDitoPeloLead: "sim, tenho" não acha número', valorDitoPeloLead('sim, tenho') === null)
  ok('valorDitoPeloLead: "ainda não pensei nisso" não acha número', valorDitoPeloLead('ainda não pensei nisso') === null)
  ok('valorDitoPeloLead: "tenho 2 funcionários" ignora número pequeno sem R$/mil', valorDitoPeloLead('tenho 2 funcionários') === null)

  const cfgOrc: any = { ...config, qualificacao: { perguntas: [...config.qualificacao.perguntas, { id: 'orcamento2', ordem: 98, obrigatoria: true, campo: 'orcamento_declarado', texto: 'Você tem orçamento reservado, ou ainda não pensou nesse investimento?', valor_minimo_aceitavel: { valor: 1199, frase_recusa: 'Poxa {nome}, no momento não consigo te ajudar.' } }] } }
  let d3 = decidir(ex({ intencoes: ['resposta_qualificacao'], dados: { orcamento_declarado: 'só uns 200' } }), est({ dados: { nome: 'Ana' } }), cfgOrc, ctx())
  ok('disse um valor claramente abaixo do mínimo: encerra na hora', d3.acao.tipo === 'encerrar' && d3.estado.etapa === 'encerrado', d3.acao.tipo)
  d3 = decidir(ex({ intencoes: ['resposta_qualificacao'], dados: { orcamento_declarado: 'sim, tenho orçamento pra isso' } }), est({ dados: { nome: 'Ana' } }), cfgOrc, ctx())
  ok('disse que tem, sem citar número: NÃO encerra, segue o fluxo', d3.acao.tipo !== 'encerrar', d3.acao.tipo)
  d3 = decidir(ex({ intencoes: ['resposta_qualificacao'], dados: { orcamento_declarado: 'ainda não pensei nesse investimento' } }), est({ dados: { nome: 'Ana' } }), cfgOrc, ctx())
  ok('"ainda não pensei" (sem número): NÃO encerra', d3.acao.tipo !== 'encerrar', d3.acao.tipo)
  d3 = decidir(ex({ intencoes: ['resposta_qualificacao'], dados: { orcamento_declarado: 'tenho uns 2000 guardados' } }), est({ dados: { nome: 'Ana' } }), cfgOrc, ctx())
  ok('valor declarado acima do mínimo: NÃO encerra', d3.acao.tipo !== 'encerrar', d3.acao.tipo)
}
// 7b2 trava da abertura: gancho de anúncio (infinitas variações) não pode disparar preço/como funciona,
// mesmo que a IA classifique errado; só o texto LITERAL do lead libera isso na primeira mensagem.
const abertura1 = ESTADO_INICIAL(3)
d = decidir(
  ex({ intencoes: ['social', 'pergunta_preco', 'pergunta_como_funciona'], social: { tipo: 'cumprimento', texto_do_lead: 'Oi' } }),
  abertura1,
  config,
  ctx({ primeiraMensagemNossa: true, mensagemLead: 'Oi, vi o anúncio do GMB por R$1.125, quero saber mais.' }),
)
ok('abertura: gancho do anúncio classificado (errado) como preço/como funciona NÃO dispara nada disso', d.acao.tipo !== 'responder_como_funciona' && d.acao.tipo !== 'responder_preco', d.acao.tipo)
d = decidir(
  ex({ intencoes: ['pergunta_como_funciona'] }),
  ESTADO_INICIAL(3),
  config,
  ctx({ primeiraMensagemNossa: true, mensagemLead: 'Oi! Vi o anúncio e quero saber por que meu negócio não aparece no Google' }),
)
ok('abertura: outra variação do gancho do anúncio também não dispara', d.acao.tipo !== 'responder_como_funciona', d.acao.tipo)
d = decidir(
  ex({ intencoes: ['pergunta_preco', 'pergunta_como_funciona'] }),
  ESTADO_INICIAL(3),
  config,
  ctx({ primeiraMensagemNossa: true, mensagemLead: 'Boa noite, quanto custa? Como funciona?' }),
)
ok('abertura: pedido EXPLÍCITO de preço e como funciona na 1ª mensagem continua funcionando', d.acao.tipo === 'responder_como_funciona', d.acao.tipo)
d = decidir(ex({ intencoes: ['pergunta_preco'] }), ESTADO_INICIAL(3), config, ctx({ primeiraMensagemNossa: true, mensagemLead: 'Boa tarde, qual o investimento?' }))
ok('abertura: "investimento" (sinônimo comum de preço) também libera a trava', d.acao.tipo === 'responder_preco', d.acao.tipo)
d = decidir(ex({ intencoes: ['pergunta_como_funciona'] }), ESTADO_INICIAL(3), config, ctx({ primeiraMensagemNossa: true, mensagemLead: 'Qual é o processo de vocês?' }))
ok('abertura: "qual é o processo" também libera a trava do como funciona', d.acao.tipo === 'responder_como_funciona', d.acao.tipo)
d = decidir(
  ex({ intencoes: ['pergunta_como_funciona'] }),
  est(),
  config,
  ctx({ mensagemLead: 'quero saber mais' }),
)
ok('fora da abertura: a IA classificando pergunta_como_funciona continua valendo normalmente', d.acao.tipo === 'responder_como_funciona', d.acao.tipo)

// 7b3 já explicou "como funciona" uma vez: nunca repete o texto fixo de novo; nova dúvida vira pergunta_fato (RAG)
const jaExplicado = est({ contadores: { ...ESTADO_INICIAL(3).contadores, como_funciona_explicado: true } })
d = decidir(ex({ intencoes: ['pergunta_como_funciona', 'pergunta_fato'], pergunta_fato: 'Precisam de acesso?' }), jaExplicado, config, ctx())
ok('já explicou: 2ª vez vira pergunta_fato de verdade, não repete o texto fixo', d.acao.tipo === 'responder_fato' && d.acao.consulta_rag === 'Precisam de acesso?', d.acao.tipo)
d = decidir(ex({ intencoes: ['pergunta_como_funciona'] }), jaExplicado, config, ctx())
ok('já explicou: pergunta_como_funciona genérica de novo também vira pergunta_fato (sem repetir o texto fixo)', d.acao.tipo === 'responder_fato', d.acao.tipo)

const cfgSemComo: any = { ...config, como_funciona: undefined }
d = decidir(ex({ intencoes: ['pergunta_como_funciona'] }), est(), cfgSemComo, ctx())
ok('sem texto fixo de como funciona: cai na dúvida sobre fato (com RAG)', d.acao.tipo === 'responder_fato' && !!d.acao.consulta_rag)

// 7f interesse em outra frente (tráfego/social/audiovisual): achado real, Rodrigo testando, 30/09/2026 — "Estou
// precisando de leads" foi ignorado e o funil seguiu perguntando sobre Google Meu Negócio, porque o funil
// inteiro (dor_central, perfil_google, escopo) só existia pra Fundação Digital. Agora reconhece e desvia.
{
  const semGmn = est({ dados: { negocio: 'clínica odontológica' } })
  d = decidir(ex({ intencoes: ['interesse_outra_frente'] }), semGmn, config, ctx())
  ok('interesse em outra frente: responde com o fato outras_frentes (não ignora)', d.acao.tipo === 'responder_fato' && d.acao.fatos.some((f) => f.id === 'outras_frentes'), d.acao.tipo)
  ok('marca escopo como outra_frente (não trava esperando resposta sobre GMN/site)', d.estado.dados.escopo === 'outra_frente', d.estado.dados.escopo)
  ok('marca dor_central e perfil_google como n/a (perguntas de GMN não fazem sentido aqui)', d.estado.dados.aparece_no_google === 'n/a' && d.estado.dados.tem_perfil_google === 'n/a')
  ok('próxima pergunta colada não é a de escopo GMN/site', !txt(d.acao).includes('configuração do Google Meu Negócio ou precisa de um site'), txt(d.acao))

  // 2ª vez: não repete o fato de novo, só deixa o funil seguir (evita o "oi de novo" a cada mensagem)
  const d2 = decidir(ex({ intencoes: ['interesse_outra_frente'] }), d.estado, config, ctx())
  ok('interesse repetido: não repete o texto do fato de novo', d2.acao.tipo !== 'responder_fato' || !d2.acao.fatos.some((f) => f.id === 'outras_frentes'), d2.acao.tipo)

  // pediu preço depois de marcado como outra_frente: nunca solta o preço do GMN/site, defere pro Bruno
  const comOutraFrente = est({ dados: { negocio: 'clínica odontológica', escopo: 'outra_frente' } })
  const d3 = decidir(ex({ intencoes: ['pergunta_preco'] }), comOutraFrente, config, ctx())
  ok('pediu preço com escopo=outra_frente: defere pro Bruno, nunca solta R$ do plano GMN/site', d3.acao.tipo === 'responder_preco' && !txt(d3.acao).includes('R$'), txt(d3.acao))

  // regressão real (lead Rodrigo/conv530, 30/09/2026): pivotou pra tráfego pago no MESMO turno em que outra
  // pergunta obrigatória (sem relação, ex.: orçamento) já estava travada há 2 tentativas — o handoff disparava
  // junto, escalando pro Bruno no exato turno em que o lead finalmente foi entendido. Dá um turno de respiro.
  const pivoComOutraTravada = est({
    dados: { negocio: 'clínica odontológica', decisor: 'sim' },
    perguntas_feitas: [
      { id: 'escopo', turno: 4, respondida: false },
      { id: 'escopo', turno: 6, respondida: false },
    ],
    turno: 6,
  })
  const d4 = decidir(ex({ intencoes: ['interesse_outra_frente'] }), pivoComOutraTravada, config, ctx())
  ok('pivotou pra outra frente com pergunta diferente já travada: NÃO escala no mesmo turno do pivô', !d4.acao.handoff, JSON.stringify(d4.acao.handoff))
  ok('mesmo sem escalar, ainda reconhece o pivô (fato outras_frentes)', d4.acao.tipo === 'responder_fato' && d4.acao.fatos.some((f) => f.id === 'outras_frentes'), d4.acao.tipo)
}

// 7h implicação lógica entre campos: achado real, lead Willian/conv944, 01/10/2026 — disse que já faz anúncio
// e mesmo assim foi perguntado se vive só de indicação, pergunta cuja resposta já estava implícita.
{
  const d = decidir(ex({ intencoes: ['resposta_qualificacao'], dados: { fez_anuncio: 'sim: Google Ads' } }), est({ dados: { negocio: 'encanador' } }), config, ctx())
  ok('fez_anuncio=sim preenche so_indicacao automaticamente (implicação lógica)', d.estado.dados.so_indicacao?.startsWith('nao'), d.estado.dados.so_indicacao)
  ok('não pergunta mais "vive só de indicação" (já implícito)', d.acao.proxima_pergunta?.id !== 'canal_aquisicao', JSON.stringify(d.acao.proxima_pergunta))

  // nunca sobrescreve resposta real que o lead já deu
  const jaRespondeu = est({ dados: { negocio: 'encanador', so_indicacao: 'sim' } })
  const d2 = decidir(ex({ intencoes: ['resposta_qualificacao'], dados: { fez_anuncio: 'sim: Google Ads' } }), jaRespondeu, config, ctx())
  ok('implicação nunca sobrescreve resposta real já dada antes', d2.estado.dados.so_indicacao === 'sim', d2.estado.dados.so_indicacao)

  // direção inversa: vive só de indicação ⟹ nunca anunciou
  const d3 = decidir(ex({ intencoes: ['resposta_qualificacao'], dados: { so_indicacao: 'sim' } }), est({ dados: { negocio: 'encanador' } }), config, ctx())
  ok('so_indicacao=sim preenche fez_anuncio automaticamente (direção inversa)', d3.estado.dados.fez_anuncio?.startsWith('nao'), d3.estado.dados.fez_anuncio)
}

// 7c config e Prime
const vcfg = validateCompanyConfig(config)
ok('config v3 da Grupo Venda é válida', vcfg.erros.length === 0, vcfg.erros.join(' | '))
const todoTexto = JSON.stringify({ ...config, palavras_proibidas: [] })
ok('Prime não aparece em nenhum texto da config', !/\bprime\b/i.test(todoTexto))
ok('Prime é palavra proibida na saída (qualquer forma)', regrasPrime(['Temos também o plano Prime.']).includes('V5:bloqueia') && regrasPrime(['O Prime é maior.']).includes('V5:bloqueia'))
ok('"primeiro" não é confundido com Prime', !regrasPrime(['No primeiro mês saem 4 posts.']).includes('V5'))

// 8 validador
const acaoBase: any = { tipo: 'perguntar', conteudo: null, fatos: [], proxima_pergunta: null, contexto: [] }
const vc = (estado = est(), ev = false): any => ({ config, estado, acao: acaoBase, mensagensDoLead: ['sou dentista em Botucatu'], ultimasNossas: ['Entendi, e qual o seu negócio?'], eventoConfirmadoNoTurno: ev })
const regras = (b: string[], v = vc()) => validar(b, v).map((x) => `${x.regra}:${x.modo}`).join(',')
ok('V1 duas perguntas', regras(['Qual o seu negócio? E a cidade?']).includes('V1'))
ok('V1 perguntas em blocos diferentes', regras(['Qual o seu negócio?', 'Tem site?']).includes('V1'))
ok('V4 valor', regras(['O plano custa R$ 1.125.']).includes('V4:bloqueia'))
ok('V5 palavra proibida', regras(['É gratuito pra você.']).includes('V5:bloqueia'))
ok('V9 travessão', regras(['Certo — vamos lá.']).includes('V9'))
ok('V10 promessa de agendamento sem evento', regras(['Vou agendar sua conversa agora.']).includes('V10:bloqueia'))
const estadoComFrase = est({ frases_enviadas: ['tenho amanha as 9h30, 15h ou 17h.', 'qual fica melhor pra voce?'] })
ok('V3 frase repetida é detectada', regras(['Tenho amanhã às 9h30, 15h ou 17h. Qual fica melhor pra você?'], vc(estadoComFrase)).includes('V3:bloqueia'))
ok('V10 liberado com evento criado', !regras(['Ana, agendado! quinta às 14h.'], vc(est(), true)).includes('V10'))
ok('TERMO diagnóstico', regras(['Nosso diagnóstico é rápido.']).includes('TERMO'))
ok('TERMO exceção "diagnóstico do perfil"', !regras(['O diagnóstico do perfil faz parte do plano.']).includes('TERMO'))
ok('HUMANO só "especialista"', regras(['Nosso especialista te chama.']).includes('HUMANO'))
ok('V2 pergunta já respondida', regras(['Você possui o perfil do Google Meu Negócio criado?'], vc(est({ dados: { tem_perfil_google: 'sim' } }))).includes('V2'))
ok('V7 registra (não bloqueia) por padrão', regras(['Entendi, boa pergunta!']).includes('V7:registro'))
ok('V6 registra número fora da fonte', regras(['Temos 350 clientes.']).includes('V6:registro'))
ok('V4 valor da config passa', !regras(['Com site, é o plano Essencial: R$ 2.200 à vista no Pix.']).includes('V4'))
ok('V4 valor inventado bloqueia (ex.: preço do que não está na config)', regras(['O plano custa R$ 3.500.']).includes('V4:bloqueia'))
const acaoLit: any = { ...acaoBase, conteudo: { modo: 'literal', texto: ['a', 'b', 'c', 'd', 'e'] } }
ok('V8 não corta texto fixo do dono (5 blocos literais)', !regras(['Um.', 'Dois.', 'Três.', 'Quatro.', 'Cinco?'], { ...vc(), acao: acaoLit }).includes('V8'))
ok('V8 continua valendo para texto livre', regras(['Um.', 'Dois.', 'Três.']).includes('V8'))
const acaoFato: any = { ...acaoBase, tipo: 'responder_fato', fatos: [{ id: 'rag', texto: 'O Grupo Venda tem mais de 7 anos de mercado e mais de 200 clientes atendidos em todo o Brasil. Cuida do Google Meu Negócio, site e Google Ads.' }] }
ok('V11 pega resposta que ignora a dúvida (só cumprimento e pergunta)', regras(['Boa noite!', 'Pra te explicar certinho, qual o seu nome?'], { ...vc(), acao: acaoFato }).includes('V11:bloqueia'))
ok('V11 pega cumprimento + apresentação sem responder (caso do lead que chega pelo anúncio)', regras(['Oi! Sou a Laura, atendente do Grupo Venda Marketing Digital.', 'Qual o seu nome?'], { ...vc(), acao: acaoFato }).includes('V11:bloqueia'))
ok('V11 deixa passar resposta real', !regras(['Temos mais de 7 anos de mercado.', 'Qual o seu nome?'], { ...vc(), acao: acaoFato }).includes('V11'))
const sujo = ['Legal — dentista!', 'Tem site? E anúncios?']
const fix = corrigirMecanico(sujo, vc(), validar(sujo, vc()))
ok('correção mecânica: 1 pergunta e sem travessão', fix.join(' ').match(/\?/g)?.length === 1 && !/[—–]/.test(fix.join(' ')), JSON.stringify(fix))

// V1 mantém a pergunta DECIDIDA, não a primeira (conv 932/935, 29/09: a pergunta-ponte ficava e a oficial sumia)
{
  const acaoPq: any = { ...vc().acao, proxima_pergunta: { id: 'perfil_google', texto: 'Você possui o perfil do Google Meu Negócio criado? Se sim, me manda o link ou um print dele.' } }
  const ctxPq = { ...vc(), acao: acaoPq }
  const ponte = ['Me fala também a cidade onde você atende?', 'Você já tem o perfil do Google Meu Negócio criado?']
  const f1 = corrigirMecanico(ponte, ctxPq, validar(ponte, ctxPq))
  ok('V1 corta a pergunta-ponte e mantém a decidida', f1.join(' ').includes('perfil do Google') && !f1.join(' ').includes('cidade'), JSON.stringify(f1))
  const devolve = ['Bom dia, tudo sim e você?', 'Você já tem o perfil do Google Meu Negócio criado?']
  const f2 = corrigirMecanico(devolve, ctxPq, validar(devolve, ctxPq))
  ok('V1 tira o "e você?" devolvido e mantém o cumprimento e a pergunta', f2.join(' ').match(/\?/g)?.length === 1 && f2.join(' ').includes('Bom dia') && f2.join(' ').includes('perfil'), JSON.stringify(f2))
}

// saudação social ("tudo bem?") nunca conta como "a" pergunta da V1: não pode apagar a pergunta de verdade (achado ao vivo, 27/09)
const comSaudacao = ['Oi, tudo bem?', 'Eu sou a Laura, aqui do Grupo Venda Marketing Digital.', 'Qual o seu nome?']
const fixSaudacao = corrigirMecanico(comSaudacao, vc(), validar(comSaudacao, vc()))
ok('correção mecânica: saudação "tudo bem?" não apaga a pergunta de verdade', fixSaudacao.join(' ').includes('Qual o seu nome?'), JSON.stringify(fixSaudacao))

// V3 sem correção mecânica era o gap original da auditoria (27/09): frase repetida ia do mesmo jeito.
const estadoRepetido = est({ frases_enviadas: ['tenho amanha as 9h30, 15h ou 17h.', 'qual fica melhor pra voce?'] })
const repetido = ['Entendi.', 'Tenho amanhã às 9h30, 15h ou 17h. Qual fica melhor pra você?']
const fixRepetido = corrigirMecanico(repetido, vc(estadoRepetido), validar(repetido, vc(estadoRepetido)))
ok('correção mecânica: V3 remove a frase repetida', !fixRepetido.some((b) => /9h30/.test(b)), JSON.stringify(fixRepetido))
const acaoComBlocoFixo: any = { ...acaoBase, bloco_fixo: 'Tenho amanhã às 9h30, 15h ou 17h. Qual fica melhor pra você?' }
const vcBloco = { ...vc(estadoRepetido), acao: acaoComBlocoFixo }
const repetidoBlocoFixo = ['Tenho amanhã às 9h30, 15h ou 17h. Qual fica melhor pra você?']
const fixBlocoFixo = corrigirMecanico(repetidoBlocoFixo, vcBloco, validar(repetidoBlocoFixo, vcBloco))
ok('correção mecânica: V3 NUNCA corta o bloco_fixo (dado real, não invenção da IA)', fixBlocoFixo.some((b) => /9h30/.test(b)), JSON.stringify(fixBlocoFixo))

// terminologia com caractere especial de regex não pode quebrar nem casar errado (achado 28/09/2026)
const cfgTermoEspecial: any = { ...config, validador: { ...config.validador, terminologia: [{ evitar: 'R$ 1.000,00 (promo)', usar: 'valor combinado' }] } }
const comTermoEspecial = ['O valor é R$ 1.000,00 (promo) pra você.']
const fixTermoEspecial = corrigirMecanico(comTermoEspecial, { ...vc(), config: cfgTermoEspecial }, [])
ok('correção mecânica: termo com caractere especial de regex não quebra', fixTermoEspecial.join(' ').includes('valor combinado'), JSON.stringify(fixTermoEspecial))

// config-validate: campo do escopo tem que bater com uma pergunta de qualificação de verdade
const cfgEscopoOrfao: any = { ...config, preco: { ...config.preco, por_escopo: { ...config.preco.por_escopo, campo: 'campo_que_nao_existe' } } }
const vEscopoOrfao = validateCompanyConfig(cfgEscopoOrfao)
ok('config-validate: acusa erro quando o campo do escopo não bate com nenhuma pergunta', vEscopoOrfao.erros.some((e) => e.includes('não corresponde a nenhuma pergunta')), vEscopoOrfao.erros.join(' | '))

testarChatV3().then(() => {
  console.log(falhas === 0 ? '\nTODOS OK' : `\n${falhas} FALHA(S)`)
  process.exit(falhas === 0 ? 0 : 1)
})
