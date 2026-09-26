import { GRUPO_VENDA_CONFIG } from '@/lib/sdr/v3/grupo-venda-config'
import { decidir, type DecisorCtx } from '@/lib/sdr/v3/decider'
import { corrigirMecanico, validar } from '@/lib/sdr/v3/validator'
import { ESTADO_INICIAL, type Extracao, type Estado } from '@/lib/sdr/v3/types'

const config: any = { ...GRUPO_VENDA_CONFIG, version: 2, agendamento: { ativo: true, calendario_id: 'x' } }
let falhas = 0
const ok = (nome: string, cond: boolean, extra = '') => {
  if (!cond) falhas++
  console.log(`${cond ? 'OK   ' : 'FALHA'} ${nome}${extra ? ' :: ' + extra : ''}`)
}
const ex = (p: Partial<Extracao>): Extracao => ({ intencoes: ['outro'], social: null, objecao_id: null, pergunta_fato: null, dados: {}, horario_escolhido: null, tom_do_lead: 'informal', confianca: 'alta', resposta_automatica: false, ...p })
const ctx = (p: Partial<DecisorCtx> = {}): DecisorCtx => ({ temCalendario: true, cobrancaAtiva: false, primeiraMensagemNossa: false, pushName: null, contextoOutbound: null, origemAnuncio: null, reuniaoExistente: null, ...p })
const est = (p: Partial<Estado> = {}): Estado => ({ ...ESTADO_INICIAL(2), etapa: 'qualificando', ...p })

// 1 abertura com pushName como palpite
let d = decidir(ex({ intencoes: ['social'], social: { tipo: 'cumprimento', texto_do_lead: 'boa tarde, vi o anúncio' } }), ESTADO_INICIAL(2), config, ctx({ primeiraMensagemNossa: true, pushName: 'Carla Souza' }))
ok('abertura pergunta o nome (intro na pergunta)', d.acao.tipo === 'perguntar' && d.acao.proxima_pergunta?.id === 'nome', d.acao.contexto.join(' | '))
ok('abertura: pushName só como palpite, nunca como dado', !d.estado.dados.nome && d.acao.contexto.some((c) => c.includes('Falo com Carla?')))
ok('abertura: reação social ligada', d.acao.reacao_social === true)

// 2 social + resposta
d = decidir(ex({ intencoes: ['social', 'resposta_qualificacao'], social: { tipo: 'retribuicao_pedida', texto_do_lead: 'tô bem e vc?' }, dados: { negocio: 'dentista em Botucatu', segmento: 'dentista', cidade: 'Botucatu' } }), est({ perguntas_feitas: [{ id: 'negocio', turno: 1, respondida: false }], turno: 1 }), config, ctx())
ok('social + resposta: segue para perfil_google', d.acao.tipo === 'perguntar' && d.acao.proxima_pergunta?.id === 'perfil_google', d.acao.proxima_pergunta?.texto)
ok('marca pergunta respondida', d.estado.perguntas_feitas[0].respondida === true)

// 3 preço
d = decidir(ex({ intencoes: ['pergunta_preco'] }), est(), config, ctx())
ok('preço antes da qualificação usa frase da config, literal', d.acao.tipo === 'responder_preco' && d.acao.conteudo?.modo === 'literal' && d.estado.pedidos_de_preco === 1)
ok('preço: continua a qualificação', !!d.acao.proxima_pergunta)
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
ok('robô: frase literal + próxima pergunta', d.acao.tipo === 'responder_identidade' && d.acao.conteudo?.modo === 'literal' && !!d.acao.proxima_pergunta)
d = decidir(ex({ intencoes: ['pede_espera'] }), est(), config, ctx())
ok('pede espera: aguardar sem pergunta', d.acao.tipo === 'aguardar' && !d.acao.proxima_pergunta)
let e2 = decidir(ex({ intencoes: ['outro'] }), est(), config, ctx())
e2 = decidir(ex({ intencoes: ['outro'] }), e2.estado, config, ctx())
ok('"outro" 2x seguidas escala', e2.acao.tipo === 'escalar')

// 7 qualificação completa e agendamento
const completo = est({ dados: { negocio: 'dentista', tem_perfil_google: 'sim', decisor: 'sim' } })
d = decidir(ex({ intencoes: ['outro'] }), completo, config, ctx())
ok('qualificação completa oferece horários', d.acao.tipo === 'oferecer_horarios')
d = decidir(ex({ intencoes: ['quer_agendar'] }), est({ dados: { negocio: 'x' } }), config, ctx())
ok('quer agendar sem qualificação: NÃO oferece horário, pergunta', d.acao.tipo === 'perguntar' && !!d.acao.proxima_pergunta, d.acao.tipo)
d = decidir(ex({ intencoes: ['escolheu_horario', 'informou_email'], horario_escolhido: '2026-10-01T14:00:00', dados: { email: 'a@b.com', nome_completo: 'Ana Souza' } }), completo, config, ctx())
ok('horário + e-mail + nome completo: agendar', d.acao.tipo === 'agendar')
d = decidir(ex({ intencoes: ['escolheu_horario'], horario_escolhido: '2026-10-01T14:00:00' }), completo, config, ctx())
ok('horário sem e-mail: pede dados', d.acao.tipo === 'pedir_dados_agendamento')
d = decidir(ex({ intencoes: ['pede_pagamento'] }), est(), config, ctx())
ok('pagamento sem cobrança ativa escala', d.acao.tipo === 'escalar')

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
ok('V10 liberado com evento criado', !regras(['Ana, agendado! quinta às 14h.'], vc(est(), true)).includes('V10'))
ok('TERMO diagnóstico', regras(['Nosso diagnóstico é rápido.']).includes('TERMO'))
ok('TERMO exceção "diagnóstico do perfil"', !regras(['O diagnóstico do perfil faz parte do plano.']).includes('TERMO'))
ok('HUMANO só "especialista"', regras(['Nosso especialista te chama.']).includes('HUMANO'))
ok('V2 pergunta já respondida', regras(['Você possui o perfil do Google Meu Negócio criado?'], vc(est({ dados: { tem_perfil_google: 'sim' } }))).includes('V2'))
ok('V7 registra (não bloqueia) por padrão', regras(['Entendi, boa pergunta!']).includes('V7:registro'))
ok('V6 registra número fora da fonte', regras(['Temos 350 clientes.']).includes('V6:registro'))
const sujo = ['Legal — dentista!', 'Tem site? E anúncios?']
const fix = corrigirMecanico(sujo, vc(), validar(sujo, vc()))
ok('correção mecânica: 1 pergunta e sem travessão', fix.join(' ').match(/\?/g)?.length === 1 && !/[—–]/.test(fix.join(' ')), JSON.stringify(fix))
console.log(falhas === 0 ? '\nTODOS OK' : `\n${falhas} FALHA(S)`)
process.exit(falhas === 0 ? 0 : 1)
