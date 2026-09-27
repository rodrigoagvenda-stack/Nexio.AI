import { GRUPO_VENDA_CONFIG } from '@/lib/sdr/v3/grupo-venda-config'
import { decidir, type DecisorCtx } from '@/lib/sdr/v3/decider'
import { corrigirMecanico, validar } from '@/lib/sdr/v3/validator'
import { validateCompanyConfig } from '@/lib/sdr/v3/config-validate'
import { ESTADO_INICIAL, type Extracao, type Estado } from '@/lib/sdr/v3/types'

const config: any = { ...GRUPO_VENDA_CONFIG, version: 3, agendamento: { ativo: true, calendario_id: 'x' } }
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

function regrasPrime(b: string[]) { return validar(b, { config, estado: est(), acao: { tipo: 'perguntar', conteudo: null, fatos: [], proxima_pergunta: null, contexto: [] } as any, mensagensDoLead: [], ultimasNossas: [], eventoConfirmadoNoTurno: false }).map((x) => `${x.regra}:${x.modo}`).join(',') }
// 7b como funciona e preço por escopo (Start e Essencial; Prime nunca aparece)
const txt = (a: any) => [a.conteudo?.texto ?? ''].flat().join('\n')
d = decidir(ex({ intencoes: ['pergunta_preco', 'pergunta_como_funciona'] }), est({ dados: { nome: 'Luciano' } }), config, ctx())
ok('como funciona: texto fixo, chama pelo nome', d.acao.tipo === 'responder_como_funciona' && d.acao.conteudo?.modo === 'literal' && txt(d.acao).startsWith('Luciano, deixa eu te explicar'), txt(d.acao).slice(0, 60))
ok('como funciona sem escopo: termina perguntando o escopo e não empilha outra pergunta', txt(d.acao).trim().endsWith('ou precisa de um site também?') && !d.acao.proxima_pergunta && d.estado.contadores.escopo_perguntado === true)
ok('como funciona não solta valor antes de saber o escopo', !txt(d.acao).includes('R$'))
const dComoSemNome = decidir(ex({ intencoes: ['pergunta_como_funciona'] }), est(), config, ctx())
ok('como funciona sem nome conhecido: sem buraco no texto', txt(dComoSemNome.acao).startsWith('Deixa eu te explicar rapidinho.'), txt(dComoSemNome.acao).slice(0, 50))
const aposComo = d.estado
d = decidir(ex({ intencoes: ['resposta_qualificacao'], dados: { escopo: 'gmn' } }), aposComo, config, ctx())
ok('escopo gmn (depois de perguntado): sai o Start, Pix e 3x sem juros', d.acao.tipo === 'responder_preco' && txt(d.acao).includes('R$ 1.199') && txt(d.acao).includes('3x de R$ 399,67') && txt(d.acao).includes('sem juros'), txt(d.acao).slice(0, 80))
ok('escopo gmn: não fala do site nem do Prime', !/2\.200|\bprime\b/i.test(txt(d.acao)))
d = decidir(ex({ intencoes: ['resposta_qualificacao'], dados: { escopo: 'site' } }), aposComo, config, ctx())
ok('escopo site: sai o Essencial, 2.200 no Pix e 6x com juros', txt(d.acao).includes('R$ 2.200') && txt(d.acao).includes('6x de R$ 397,03') && txt(d.acao).includes('com juros') && !/prime/i.test(txt(d.acao)))
d = decidir(ex({ intencoes: ['pergunta_preco'] }), est({ dados: { escopo: 'gmn' } }), config, ctx())
ok('preço com escopo já conhecido: responde direto', d.acao.tipo === 'responder_preco' && txt(d.acao).includes('R$ 1.199'))
d = decidir(ex({ intencoes: ['pergunta_preco', 'pergunta_como_funciona'] }), est({ dados: { escopo: 'site' } }), config, ctx())
ok('valor + como funciona com escopo conhecido: explica e já dá o valor, sem re-perguntar', txt(d.acao).toLowerCase().includes('deixa eu te explicar') && txt(d.acao).includes('R$ 2.200') && !txt(d.acao).includes('ou precisa de um site também?'))
d = decidir(ex({ intencoes: ['pergunta_preco'] }), est({ dados: { nome: 'Ana' }, pedidos_de_preco: 1, contadores: { ...ESTADO_INICIAL(3).contadores, escopo_perguntado: true } }), config, ctx())
ok('insistiu no valor sem responder o escopo: chama o Bruno (não fica sem resposta)', d.acao.tipo === 'escalar')
ok('escopo dito sem ninguém ter perguntado: só guarda, não solta valor', decidir(ex({ intencoes: ['resposta_qualificacao'], dados: { escopo: 'gmn' } }), est(), config, ctx()).acao.tipo !== 'responder_preco')
const cfgSemComo: any = { ...config, como_funciona: undefined }
d = decidir(ex({ intencoes: ['pergunta_como_funciona'] }), est(), cfgSemComo, ctx())
ok('sem texto fixo de como funciona: cai na dúvida sobre fato (com RAG)', d.acao.tipo === 'responder_fato' && !!d.acao.consulta_rag)

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
console.log(falhas === 0 ? '\nTODOS OK' : `\n${falhas} FALHA(S)`)
process.exit(falhas === 0 ? 0 : 1)
