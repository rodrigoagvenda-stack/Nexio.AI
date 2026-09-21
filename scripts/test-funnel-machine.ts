/**
 * Testes da máquina de estados do funil (lib/sdr/funnel/machine.ts) com o
 * roteiro real do Grupo Venda. Sem banco, sem IA : a máquina é pura.
 * Rodar: npx tsx scripts/test-funnel-machine.ts
 */
import { splitOpening, stepFunnel } from '../lib/sdr/funnel/machine'
import { grupoVendaFunnel as cfg, genericFunnelTemplate } from '../lib/sdr/funnel/templates'
import { validateFunnelConfig } from '../lib/sdr/funnel/validate'
import { detectAskedStep } from '../lib/sdr/funnel/sync'
import { buildResumo, nextStatus } from '../lib/sdr/funnel/crm'
import { buildEcho, leadVolunteered, shouldReact, structuralChecks } from '../lib/sdr/funnel/reaction'
import { DEFAULT_AUDIO_FAIL_REPLY, isUnreadableAudio } from '../lib/sdr/funnel/audio'
import { buildFicha, structuralHumanChecks } from '../lib/sdr/funnel/humanize'
import { buildReaderPrompt, evidenceOk, validateReading } from '../lib/sdr/funnel/reader'
import { countMessages, dropOwnQuestions, formatMemoria, formatTranscript, structuralMemoryChecks } from '../lib/sdr/funnel/memory'
import { BOX_REVIEW_KEYS, evaluateBoxReview, validateBoxAnswer } from '../lib/sdr/funnel/box'
import { firedStepsByLead } from '../lib/sdr/follow-round'
import { CONVERSE_REVIEW_KEYS, evaluateConverseReview, structuralConversationChecks } from '../lib/sdr/funnel/converse'
import { isRepeatOf } from '../lib/sdr/output-guard'
import { isTooSoon, MIN_NOTICE_MINUTES } from '../lib/slot-notice'
import { needsUnderstanding } from '../lib/sdr/media-understanding'
import { ConversationQueue, conversationKey } from '../lib/sdr/conversation-queue'
import { initialState, type Categoria, type FunnelAction, type FunnelState, type Reading, type StepInput } from '../lib/sdr/funnel/types'

let failed = 0
function check(name: string, ok: boolean, detail?: unknown) {
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
  if (!ok && detail !== undefined) console.log('      ', JSON.stringify(detail))
}

function read(categoria: Categoria, dados: Record<string, string> = {}, extra: Partial<Reading> = {}): Reading {
  return { categoria, objecaoTipo: null, dados, confianca: 0.9, ...extra }
}

function turn(state: FunnelState, reading: Reading, input: Partial<StepInput> = {}) {
  return stepFunnel(cfg, state, reading, { isFirstTurn: false, leadText: '', ...input })
}

const sent = (actions: FunnelAction[]): string[] =>
  actions.filter((a): a is Extract<FunnelAction, { type: 'send' }> => a.type === 'send').flatMap((a) => a.texts)
const has = (actions: FunnelAction[], type: FunnelAction['type']) => actions.some((a) => a.type === type)

// ─── Abertura e nome ────────────────────────────────────────────────────
{
  const r = turn(initialState(), read('outro'), { isFirstTurn: true })
  check('abertura: primeira mensagem manda o Passo 0 palavra por palavra', sent(r.actions)[0] === cfg.steps[0].question, r.actions)
}
{
  const r = turn(initialState(), read('preco'), { isFirstTurn: true })
  check('abertura: preço na 1a mensagem (texto de anúncio) vira abertura, não resposta de preço', sent(r.actions)[0] === cfg.steps[0].question && r.state.priceAsked === 0, r)
}
{
  const s1 = turn(initialState(), read('outro'), { isFirstTurn: true }).state
  const r = turn(s1, read('resposta_passo', { nome: 'carlos silva' }))
  check('nome capitalizado e usado no Passo 1', sent(r.actions)[0] === 'Carlos Silva, qual o nome, o ramo e a cidade da sua empresa?', sent(r.actions))
}
{
  // Anderson/Sidnei : nome do perfil não pode entrar como nome se o passo 0 não foi perguntado
  const r = turn(initialState(), read('outro', { nome: 'Eu Mesmo' }), { isFirstTurn: true })
  check('nome só é aceito quando a pergunta de nome foi feita', r.state.data.nome === undefined, r.state.data)
}

// ─── Extração múltipla e ordem ─────────────────────────────────────────
{
  const all = read('resposta_passo', {
    nome: 'Ana',
    ramo: 'loja de roupas',
    cidade: 'Curitiba',
    tem_gmb: 'nao',
    tem_site: 'nao',
    fez_anuncio: 'nao',
    so_indicacao: 'sim',
    aparece_google: 'nao',
    decisor: 'sim',
  })
  const r1 = turn(initialState(), all, { isFirstTurn: true })
  check('tudo numa mensagem: ainda pergunta o nome primeiro', sent(r1.actions)[0] === cfg.steps[0].question, sent(r1.actions))
  check('tudo numa mensagem: decisor solto não é aceito', r1.state.data.decisor === undefined && r1.state.data.ramo === 'loja de roupas', r1.state.data)
  const r2 = turn(r1.state, read('resposta_passo', { nome: 'ana' }))
  check('tudo numa mensagem: depois do nome, o ÚLTIMO passo (decisor) é perguntado sozinho', sent(r2.actions).length === 1 && sent(r2.actions)[0] === cfg.steps[7].question, sent(r2.actions))
  const r3 = turn(r2.state, read('resposta_passo', { decisor: 'sim' }))
  check('decisor confirmado: qualificação completa, delega o agendamento', has(r3.actions, 'delegate_scheduling') && r3.state.stage === 'scheduling', r3)
}
{
  const s = turn(turn(initialState(), read('outro'), { isFirstTurn: true }).state, read('resposta_passo', { nome: 'Paulo' })).state
  const r = turn(s, read('resposta_passo', { ramo: 'barbearia' }))
  check('resposta parcial: pergunta só o que falta', sent(r.actions)[0] === 'E a cidade?', sent(r.actions))
}
{
  const base = { nome: 'Paulo', ramo: 'barbearia', cidade: 'Salvador' }
  let s = turn(initialState(), read('outro'), { isFirstTurn: true }).state
  s = turn(s, read('resposta_passo', { nome: 'Paulo' })).state
  s = turn(s, read('resposta_passo', base)).state
  const r1 = turn(s, read('resposta_passo', { tem_gmb: 'sim' }))
  check('tem perfil mas sem link: pede o link/print uma vez', sent(r1.actions)[0] === 'Consegue me mandar o link ou print do perfil?', sent(r1.actions))
  const r2 = turn(r1.state, read('resposta_passo', {}))
  check('não mandou o link: segue pro Passo 3 sem insistir', sent(r2.actions)[0] === 'Tem site?', sent(r2.actions))
}

// ─── Preço ──────────────────────────────────────────────────────────────
function emQualificacao() {
  let s = turn(initialState(), read('outro'), { isFirstTurn: true }).state
  s = turn(s, read('resposta_passo', { nome: 'Marcos' })).state
  return s
}
{
  // Política de preço (Rodrigo, 2026-09-21): 1a dá o ponto de partida, 2a mostra os planos, 3a passa pro Bruno.
  const r1 = turn(emQualificacao(), read('preco'))
  const t = sent(r1.actions)
  check('preço 1a vez: ponto de partida com valores e pergunta do objetivo (não se esquiva)', t.length === 1 && t[0] === cfg.priceScripts[0] && /R\$ 1\.125/.test(t[0]) && /R\$ 5\.280/.test(t[0]) && t[0].includes('pagamento único'), t)
  const r2 = turn(r1.state, read('preco'))
  check('preço 2a vez: mostra os três planos, NÃO repete a frase anterior', sent(r2.actions)[0] === cfg.priceScripts[1] && sent(r2.actions)[0] !== t[0], sent(r2.actions))
  const r2b = turn(r2.state, read('preco'))
  check('preço 3a vez: passa pro Bruno na hora', has(r2b.actions, 'handoff') && r2b.state.stage === 'handoff' && sent(r2b.actions).length === 0, r2b.actions)
  const h = r2b.actions.find((a) => a.type === 'handoff') as Extract<FunnelAction, { type: 'handoff' }>
  check('preço 3a vez: texto de espera do script aprovado', h.texts[0] === cfg.priceInsistHandoff, h.texts)
  const r3 = turn(r2b.state, read('outro'))
  check('depois do handoff o funil fica em silêncio', has(r3.actions, 'silence'), r3.actions)
  check('preço: as respostas são marcadas pra o SDR reescrever (com revisão)', r1.actions.some((a) => a.type === 'send' && a.humanize?.kind === 'preco'), r1.actions)
}

// ─── Objeções ───────────────────────────────────────────────────────────
{
  const r = turn(emQualificacao(), read('objecao', {}, { objecaoTipo: 'caro' }))
  const t = sent(r.actions)
  check('objeção "caro": script verbatim, sem emendar pergunta do funil (script já pergunta)', t.length === 1 && t[0] === cfg.objections.caro.scripts[0], t)
}
{
  const r = turn(emQualificacao(), read('objecao', {}, { objecaoTipo: 'retorno' }))
  const t = sent(r.actions)
  check('objeção sem pergunta no script: script + pergunta pendente do funil', t.length === 2 && t[0] === cfg.objections.retorno.scripts[0], t)
}
{
  let s = emQualificacao()
  s = turn(s, read('objecao', {}, { objecaoTipo: 'caro' })).state
  s = turn(s, read('objecao', {}, { objecaoTipo: 'pensar' })).state
  const r = turn(s, read('objecao', {}, { objecaoTipo: 'ja_uso' }))
  check('3a objeção: encerra com elegância, sem pressionar', sent(r.actions)[0] === cfg.refusalReply && r.state.stage === 'refused' && has(r.actions, 'mark_refused'), r)
}
{
  const s1 = turn(emQualificacao(), read('objecao', {}, { objecaoTipo: 'caro' })).state
  const r = turn(s1, read('objecao', {}, { objecaoTipo: 'caro' }))
  check('mesma objeção 2x: nunca repete o script, passa pro humano', has(r.actions, 'handoff') && sent(r.actions).length === 0, r.actions)
}
{
  const r = turn(emQualificacao(), read('objecao', {}, { objecaoTipo: 'golpe' }))
  check('FAQ (golpe/CNPJ): resposta fixa, não conta como objeção', sent(r.actions)[0] === cfg.objections.golpe.scripts[0] && r.state.objectionTurns === 0, r.state)
}
{
  const r = turn(emQualificacao(), read('objecao', {}, { objecaoTipo: 'inventada' }))
  check('tipo de objeção desconhecido: não inventa, volta pro funil', sent(r.actions).length === 1 && sent(r.actions)[0].includes('qual o nome, o ramo'), sent(r.actions))
}

// ─── Recusa, bot, despedida, humano ─────────────────────────────────────
{
  const r = turn(emQualificacao(), read('recusa'))
  check('recusa: resposta aprovada e nada mais', sent(r.actions)[0] === cfg.refusalReply && r.state.stage === 'refused', r)
  const r2 = turn(r.state, read('outro'))
  check('depois da recusa, "ok" não gera mensagem', has(r2.actions, 'silence'), r2.actions)
  const r3 = turn(r2.state, read('despedida'))
  check('despedida depois da recusa: agradece uma vez', sent(r3.actions)[0] === cfg.farewellReply, r3.actions)
  const r4 = turn(r3.state, read('despedida'))
  check('segunda despedida: silêncio', has(r4.actions, 'silence'), r4.actions)
  const r5 = turn(r4.state, read('pergunta_fora'), { leadText: 'Vocês fazem site?' })
  check('pergunta nova depois da recusa reabre o funil', r5.needBox === 'Vocês fazem site?' && r5.state.stage === 'qualifying', r5)
}
{
  const r = turn(emQualificacao(), read('bot_automatico'))
  check('resposta automática de outra empresa: silêncio', has(r.actions, 'silence') && sent(r.actions).length === 0, r.actions)
}
{
  const r = turn(emQualificacao(), read('despedida'))
  check('"ok" no meio da qualificação não é despedida: repete a pergunta pendente', sent(r.actions)[0].includes('qual o nome, o ramo'), sent(r.actions))
}
{
  const r = turn(emQualificacao(), read('pede_humano'))
  check('pede humano: passa na hora', has(r.actions, 'handoff') && r.state.stage === 'handoff', r.actions)
}
{
  const r = turn(emQualificacao(), read('resposta_passo', {}, { confianca: 0.2, categoria: 'recusa' }))
  check('baixa confiança não vira recusa nem preço: volta pro funil', r.state.stage === 'qualifying' && sent(r.actions).length === 1, r)
}

// ─── Decisor ambíguo e limites ──────────────────────────────────────────
{
  const base = { nome: 'Marcos', ramo: 'padaria', cidade: 'Olinda', tem_gmb: 'nao', tem_site: 'nao', fez_anuncio: 'nao', so_indicacao: 'sim', aparece_google: 'nao' }
  let s = emQualificacao()
  s = turn(s, read('resposta_passo', base)).state
  check('chegou no decisor sem ter perguntado antes', s.askedStep === 'decisor', s.askedStep)
  const r1 = turn(s, read('resposta_passo', {}))
  check('decisor ambíguo: pergunta de novo de forma direta', sent(r1.actions)[0] === cfg.steps[7].clarify, sent(r1.actions))
  const r2 = turn(r1.state, read('outro'))
  const r3 = turn(r2.state, read('outro'))
  check('decisor nunca esclarecido: passa pro humano em vez de agendar', has(r3.actions, 'handoff') && r3.state.stage === 'handoff', r3.actions)
}
{
  let s = emQualificacao()
  let r = turn(s, read('outro'))
  r = turn(r.state, read('outro'))
  r = turn(r.state, read('outro'))
  check('lead que nunca responde o passo: 3 tentativas e passa pro humano, sem loop', has(r.actions, 'handoff'), r.actions)
}
{
  let s = initialState()
  let last = turn(s, read('outro', {}, { falhou: true }), { isFirstTurn: true })
  last = turn(last.state, read('outro', {}, { falhou: true }))
  last = turn(last.state, read('outro', {}, { falhou: true }))
  check('leitor falhando 3x seguidas: passa pro humano', has(last.actions, 'handoff'), last.actions)
}

// ─── Caixa controlada (pergunta fora do roteiro) ────────────────────────
{
  const r1 = turn(emQualificacao(), read('pergunta_fora'), { leadText: 'Fazem tráfego pago?' })
  check('pergunta fora: pede a caixa, ainda não envia nada', r1.needBox === 'Fazem tráfego pago?' && r1.actions.length === 0, r1)
  const r2 = turn(emQualificacao(), read('pergunta_fora'), { leadText: 'x', boxAnswer: 'Trabalhamos com Google Ads e Meta Ads.' })
  const t = sent(r2.actions)
  check('caixa respondeu: resposta + pergunta do funil (uma pergunta só)', t.length === 2 && t[0] === 'Trabalhamos com Google Ads e Meta Ads.' && t[1].includes('qual o nome, o ramo'), t)
  const r3 = turn(emQualificacao(), read('pergunta_fora'), { leadText: 'x', boxAnswer: null })
  check('caixa sem base: texto aprovado + pergunta do funil, sem inventar', sent(r3.actions)[0] === cfg.unknownAnswer && sent(r3.actions).length === 2, sent(r3.actions))
  const r4 = turn(r3.state, read('pergunta_fora'), { leadText: 'y', boxAnswer: null })
  check('caixa sem base 2x: passa pro Bruno', has(r4.actions, 'handoff'), r4.actions)
}

// ─── Ligação ────────────────────────────────────────────────────────────
{
  const r1 = turn(emQualificacao(), read('pede_ligacao'))
  check('pede ligação: oferece as duas opções (roteiro aprovado)', sent(r1.actions)[0] === cfg.callOffer && r1.state.callOffered, r1)
  const r2 = turn(r1.state, read('aceita_ligacao'))
  check('aceita ligação: confirma, avisa o Bruno e continua a qualificação', sent(r2.actions)[0] === cfg.callConfirm && has(r2.actions, 'notify') && sent(r2.actions).length === 2, r2.actions)
}

// ─── Estado é imutável entre chamadas (o runner chama duas vezes na caixa) ──
{
  const s = emQualificacao()
  const snapshot = JSON.stringify(s)
  turn(s, read('pergunta_fora'), { leadText: 'q' })
  turn(s, read('pergunta_fora'), { leadText: 'q', boxAnswer: 'ok' })
  check('stepFunnel não muta o estado recebido', JSON.stringify(s) === snapshot)
}

// ─── Funil acompanha a conversa real quando uma pessoa assume (caso Isaías) ─
{
  const st = { ...initialState(), data: { nome: 'Isaías' } }
  check('pergunta feita por pessoa é reconhecida: anúncios', detectAskedStep(cfg, st, ['Já fez anúncio no Google ou no Meta?']) === 'anuncios')
  check('pergunta curta feita por pessoa: "Tem site?"', detectAskedStep(cfg, st, ['Tem site?']) === 'site')
  check(
    'pergunta em duas mensagens da pessoa (perfil do Google)',
    detectAskedStep(cfg, st, ['Se sim, me manda o link ou um print dele.', 'Você possui o perfil do Google Meu Negócio criado?']) === 'perfil_google'
  )
  check('pergunta com o nome do lead na frente', detectAskedStep(cfg, st, ['Isaías, qual o nome, o ramo e a cidade da sua empresa?']) === 'negocio')
  check('comentário da pessoa não é pergunta do roteiro', detectAskedStep(cfg, st, ['Acessei o site, Isaías, a estrutura está muito boa por sinal!']) === null)
  check('comentário depois da pergunta: ainda acha a pergunta', detectAskedStep(cfg, st, ['Acessei o site, a estrutura está muito boa!', 'Já fez anúncio no Google ou no Meta?']) === 'anuncios')

  const p = buildReaderPrompt({
    config: cfg,
    state: st,
    leadText: 'Sim',
    transcript: ['Equipe: Tem site?', 'Lead: Sim, temos um site oficial!', 'Equipe: Já fez anúncio no Google ou no Meta?'],
    isFirstTurn: false,
  })
  check('leitor recebe a conversa real (o que a equipe perguntou por último)', p.user.includes('Equipe: Já fez anúncio no Google ou no Meta?') && p.user.includes('Lead: Sim, temos um site oficial!'), p.user)
  check('leitor não usa mais a "pergunta pendente" desatualizada do estado', !p.user.includes('Pergunta pendente'))

  // Reprodução do caso: o site foi respondido durante a pausa, o "Sim" é da pergunta de anúncios
  const base = { ...initialState(), data: { nome: 'Isaías', ramo: 'transporte executivo', cidade: 'Barueri', tem_gmb: 'sim', gmb_link: 'https://share.google/x' }, askedStep: 'anuncios' }
  const r = turn(base, read('resposta_passo', { tem_site: 'sim', fez_anuncio: 'sim' }))
  check('site respondido na pausa + "Sim" dos anúncios: segue pro passo 5, não repete "Tem site?"', sent(r.actions)[0] === 'Hoje, você vive só de indicação e boca a boca?', sent(r.actions))
}

// ─── Reação humana: quando reagir e a forma da frase (caso Cristiane, "Sim sem retorno") ─
{
  const base = { ...initialState(), turns: 6 }
  const enviar = [{ type: 'send' as const, texts: ['Hoje, você vive só de indicação e boca a boca?'] }]
  const rd = (over: Partial<Reading> = {}): Reading => ({ ...read('resposta_passo', { fez_anuncio: 'sim' }), comentario: true, ...over })
  const ok = (over: Partial<Parameters<typeof shouldReact>[0]> = {}) =>
    shouldReact({ state: base, reading: rd(), actions: enviar, isFirstTurn: false, enabled: true, ...over })

  check('reage: lead respondeu e desabafou ("Sim sem retorno")', ok() === true)
  check('não reage: resposta seca (comentario falso)', ok({ reading: rd({ comentario: false }) }) === false)
  check('não reage: leitor não marcou comentario', ok({ reading: { ...read('resposta_passo'), comentario: undefined } }) === false)
  check('não reage: objeção tem resposta aprovada', ok({ reading: rd({ categoria: 'objecao' }) }) === false)
  check('não reage: pergunta de preço', ok({ reading: rd({ categoria: 'preco' }) }) === false)
  check('não reage: primeira mensagem', ok({ isFirstTurn: true }) === false)
  check('não reage: recurso desligado na empresa', ok({ enabled: false }) === false)
  check('não reage: passando pra pessoa', ok({ actions: [{ type: 'handoff', reason: 'x', texts: ['y'] }] }) === false)
  check('não reage: fim do roteiro (transição pro agendamento)', ok({ actions: [{ type: 'delegate_scheduling' }] }) === false)
  check('não reage: já tem texto fixo antes da pergunta', ok({ actions: [{ type: 'send', texts: ['script', 'pergunta'] }] }) === false)
  check('não reage: intervalo entre reações (última há 2 turnos)', ok({ state: { ...base, reactionTurn: 4 } }) === false)
  check('reage de novo depois do intervalo', ok({ state: { ...base, reactionTurn: 3 } }) === true)
  check(
    'texto com dados e SEM desabafo não reage (o leitor não marca comentario)',
    ok({ reading: rd({ dados: { nome: 'Erasmo', cidade: 'São Paulo' }, comentario: false }) }) === false
  )

  // Mídia: sempre respondida (caso Erasmo: áudio descrevendo o salão foi tratado como bot)
  check('ÁUDIO/imagem: sempre reage, mesmo sem desabafo', ok({ reading: rd({ comentario: false }), hasMedia: true }) === true)
  check('mídia: reage mesmo com vários dados no áudio', ok({ reading: rd({ dados: { ramo: 'salão', cidade: 'SP', nome_empresa: 'X' }, comentario: false }), hasMedia: true }) === true)
  check('mídia: reage mesmo com a reação desligada na empresa', ok({ enabled: false, hasMedia: true }) === true)
  check('mídia: ignora o intervalo entre reações', ok({ state: { ...base, reactionTurn: 5 }, hasMedia: true }) === true)
  check('mídia: se o lead fez pergunta de preço, quem responde é o script (sem reação)', ok({ reading: rd({ categoria: 'preco' }), hasMedia: true }) === false)
  check('mídia: primeira mensagem vira abertura', ok({ isFirstTurn: true, hasMedia: true }) === false)
  check('mídia: passando pra pessoa não reage', ok({ actions: [{ type: 'handoff', reason: 'x', texts: ['y'] }], hasMedia: true }) === false)

  const eco = (before: Record<string, string>, after: Record<string, string>, kind: 'audio' | 'imagem' | 'outro' = 'audio') => buildEcho(cfg, before, after, kind)
  check(
    'eco: confirma só os dados novos guardados ("Anotei: ...")',
    eco({ nome: 'Erasmo' }, { nome: 'Erasmo', nome_empresa: 'Tesoura de Ouro', ramo: 'salão de beleza', cidade: 'São Paulo' }) === 'Anotei: Tesoura de Ouro, salão de beleza, São Paulo.'
  )
  check('eco: não repete dado que já estava guardado', eco({ ramo: 'salão' }, { ramo: 'salão', cidade: 'Recife' }) === 'Anotei: Recife.')
  check('eco: não inclui sim/não nem o nome da pessoa', eco({}, { nome: 'Ana', tem_site: 'sim' }) === 'Recebi o seu áudio.')
  check('eco sem dado novo em imagem', eco({}, {}, 'imagem') === 'Recebi a imagem, obrigada.')

  const forma = (frase: string, over: Partial<Parameters<typeof structuralChecks>[0]> = {}) =>
    structuralChecks({ frase, leadText: 'perdi minha conta de 10 anos', lastQuestion: 'Já fez anúncio no Google ou no Meta?', recentOutbound: [], ...over })
  check('forma ok: empatia curta com número do próprio lead', forma('Poxa, perder uma conta de 10 anos é complicado.') === null)
  check('forma: recusa pergunta', forma('Poxa, e aí, como foi?') === 'tem_pergunta' || forma('Poxa, e como foi?') === 'tem_pergunta')
  check('forma: recusa número que o lead não disse', forma('Poxa, 5 anos é muito tempo.') === 'numero_inventado')
  check('forma: recusa valor em reais', forma('Poxa, gastar R$ 500 é complicado.') === 'tem_valor')
  check('forma: recusa frase longa', forma('Poxa, isso realmente deve ter sido muito complicado e chato de passar por essa situação toda sozinho no começo do seu negócio, sem ninguém ajudando.') === 'longa_demais')
  check('forma: recusa travessão e markdown', forma('Poxa — isso é complicado.') === 'formato')
  check('forma: recusa frase vazia', forma('   ') === 'vazia')
  check('forma: recusa repetir frase recente', forma('Poxa, isso é complicado.', { recentOutbound: ['Poxa, isso é complicado.'] }) === 'repetida')
  check('forma: recusa justificativa', forma('Assim já consigo te entender melhor.') === 'justificativa')
}

// ─── Depois do roteiro o funil continua vivo (caso Marcelo) ─────────────
{
  const dados = { nome: 'Marcelo', ramo: 'construção', cidade: 'Alvorada', tem_gmb: 'nao', tem_site: 'nao', fez_anuncio: 'nao', so_indicacao: 'sim', aparece_google: 'nao', decisor: 'sim' }
  const sched: FunnelState = { ...initialState(), stage: 'scheduling', data: dados, turns: 9 }
  const pos = (cat: Categoria, over: Partial<Reading> = {}, s = sched) => turn(s, read(cat, {}, over))

  check('pós-roteiro: recusa é tratada pelo funil (resposta aprovada + encerra)', sent(pos('recusa').actions)[0] === cfg.refusalReply && pos('recusa').state.stage === 'refused')
  check('pós-roteiro: recusa marca o lead como perdido (mark_refused)', has(pos('recusa').actions, 'mark_refused'))
  check('pós-roteiro: pedido de pessoa passa pro Bruno com aviso ao lead', has(pos('pede_humano').actions, 'handoff') && pos('pede_humano').state.stage === 'handoff')
  const p1 = pos('preco')
  check('pós-roteiro: 1a pergunta de preço usa a resposta que fecha chamando pro horário', sent(p1.actions)[0] === cfg.pricePosRoteiro && !has(p1.actions, 'delegate_scheduling'), p1.actions)
  const p2 = pos('preco', {}, p1.state)
  check('pós-roteiro: 2a pergunta de preço mostra os planos (nunca repete)', sent(p2.actions)[0] === cfg.priceScripts[1], sent(p2.actions))
  const p3 = pos('preco', {}, p2.state)
  check('pós-roteiro: 3a pergunta de preço chama o Bruno', has(p3.actions, 'handoff'), p3.actions)
  const ob = pos('objecao', { objecaoTipo: 'sem_tempo' })
  check('pós-roteiro: objeção usa o script aprovado (marcado pra reescrita) e não entrega ao agendamento', sent(ob.actions)[0] === cfg.objections.sem_tempo.scripts[0] && !has(ob.actions, 'delegate_scheduling'), ob.actions)
  const faq = pos('objecao', { objecaoTipo: 'golpe' })
  check('pós-roteiro: dado da empresa (CNPJ) sai palavra por palavra, sem reescrita', sent(faq.actions)[0] === cfg.objections.golpe.scripts[0] && !faq.actions.some((a) => a.type === 'send' && a.humanize), faq.actions)
  check('pós-roteiro: dúvida vai pra caixa e depois só responde (sem pergunta do funil)', pos('pergunta_fora').needBox !== undefined)
  const dv = turn(sched, read('pergunta_fora'), { leadText: 'x', boxAnswer: 'Trabalhamos com Google Meu Negócio e site.' })
  check('pós-roteiro: resposta da caixa sai sozinha, sem repetir pergunta de roteiro nem entregar', sent(dv.actions).length === 1 && !has(dv.actions, 'delegate_scheduling'), dv.actions)
  check('pós-roteiro: mensagem automática de outra empresa fica em silêncio', has(pos('bot_automatico').actions, 'silence'))
  const d1 = pos('despedida')
  check('pós-roteiro: despedida agradece uma vez', sent(d1.actions)[0] === cfg.farewellReply, d1.actions)
  check('pós-roteiro: despedida repetida fica em silêncio (caso André)', has(pos('despedida', {}, d1.state).actions, 'silence'))
  for (const c of ['agendar', 'outro', 'resposta_passo', 'ok'] as Categoria[]) {
    check(`pós-roteiro: "${c}" vai pro agendamento (única coisa que o orquestrador faz)`, pos(c).actions.length === 1 && has(pos(c).actions, 'delegate_scheduling'))
  }
  check('pós-roteiro: categoria incerta (baixa confiança) vai pro agendamento', has(pos('recusa', { confianca: 0.2 }).actions, 'delegate_scheduling'))
}

// ─── Preço reescrito pelo SDR: forma conferida em código ───────────────
{
  const script = cfg.priceScripts[0]
  const base = { script, leadText: 'quanto custa por mês?', ficha: 'ficha', recentOutbound: [] as string[], kind: 'preco' as const }
  const forma = (texto: string, over: Partial<typeof base> = {}) => structuralHumanChecks({ texto, ...base, ...over })
  check(
    'reescrita ok: outras palavras, mesmos valores, mesma pergunta',
    forma('Depende do que você precisa: vai de R$ 1.125, só o perfil no Google, até R$ 5.280, com perfil e site completo. Não tem mensalidade, é pagamento único. O que você mais precisa hoje?') === null
  )
  check('reescrita recusada: sumiu um valor', forma('Depende do que você precisa: a partir de R$ 1.125, só o perfil no Google. Pagamento único. O que você mais precisa hoje?') === 'valor_faltando')
  check('reescrita recusada: valor inventado', forma('Vai de R$ 1.125 até R$ 5.280, e tem um plano de R$ 999. O que você precisa?') === 'valor_novo')
  check('reescrita recusada: número que ninguém disse', forma('Vai de R$ 1.125 até R$ 5.280 em 12 dias. O que você mais precisa hoje?') === 'numero_inventado')
  const semPergunta = 'Tranquilo, posso ajustar pro horário que encaixa melhor na sua rotina.'
  check('reescrita recusada: pergunta nova quando o script não tinha', structuralHumanChecks({ ...base, script: semPergunta, kind: 'objecao', texto: 'Tranquilo, a gente ajusta. Qual horário você prefere?' }) === 'pergunta_nova')
  check('reescrita recusada: repete o que já foi enviado', forma(script, { recentOutbound: [script] }) === 'repetida')
  check('reescrita recusada: travessão', forma('Depende do que você precisa — de R$ 1.125 até R$ 5.280. O que você precisa?') === 'formato')

  const st = { ...initialState(), stage: 'scheduling' as const, priceAsked: 1, objections: { sem_tempo: 1 }, data: { nome: 'Marcelo', ramo: 'construção', cidade: 'Alvorada', tem_site: 'nao' } }
  const f = buildFicha(cfg, st)
  check('ficha: fatos do lead', f.includes('Nome: Marcelo') && f.includes('Ramo: construção') && f.includes('Cidade: Alvorada'), f)
  check('ficha: o que já foi dito (transição, preço, objeção)', f.includes('JÁ foi enviada') && f.includes('valor 1 vez') && f.includes('sem tempo'), f)
  check('ficha: regras fixas (horário comercial, sem promessa)', f.includes('horário comercial') && f.includes('nunca prometer'), f)

  check('validação: R$ nas respostas de preço passa quando a política de ponto de partida está ligada', validateFunnelConfig(cfg).length === 0, validateFunnelConfig(cfg))
  check('validação: R$ sem a política ligada é recusado', validateFunnelConfig({ ...cfg, priceDisclosure: false }).some((e) => e.includes('valor em reais')))
}

// ─── Áudio que não foi transcrito ───────────────────────────────────────
{
  check('áudio sem transcrição (só o rótulo) é reconhecido', isUnreadableAudio('🎵 Áudio') === true)
  check('vários áudios sem transcrição também', isUnreadableAudio('🎵 Áudio\n🎵 Áudio') === true)
  check('áudio transcrito NÃO é ilegível', isUnreadableAudio('Meu salão fica na Rua das Flores, em São Paulo') === false)
  check('texto junto com áudio sem transcrição NÃO é ilegível', isUnreadableAudio('Segue meu endereço\n🎵 Áudio') === false)
  check('texto comum NÃO é ilegível', isUnreadableAudio('Ok') === false)
  check('aviso padrão é uma frase só, com uma pergunta', DEFAULT_AUDIO_FAIL_REPLY.split('?').length === 2)
}

// ─── "Ok" sem conteúdo: espera, não repete a pergunta (caso Erasmo) ─────
{
  const s = emQualificacao()
  const r1 = turn(s, read('ok'))
  check('"ok" sem conteúdo: primeira vez fica em silêncio, sem repetir a pergunta', has(r1.actions, 'silence') && sent(r1.actions).length === 0 && r1.state.okWaited === true, r1.actions)
  check('"ok": não gasta tentativa do passo', r1.state.asks.negocio === s.asks.negocio, r1.state.asks)
  const r2 = turn(r1.state, read('ok'))
  check('"ok" de novo em seguida: aí a pergunta volta', sent(r2.actions).length === 1 && sent(r2.actions)[0].includes('qual o nome, o ramo'), r2.actions)
  const r3 = turn(r1.state, read('resposta_passo', { ramo: 'barbearia', cidade: 'Salvador' }))
  check('depois do "ok", o lead responde: segue normal', sent(r3.actions)[0].startsWith('Você possui o perfil'), sent(r3.actions))
  const r4 = turn(turn(r1.state, read('resposta_passo', {})).state, read('ok'))
  check('"ok" volta a ser esperado depois que o lead fala de outra coisa', has(r4.actions, 'silence'), r4.actions)
  const r5 = turn(initialState(), read('ok'), { isFirstTurn: true })
  check('"ok" na primeira mensagem vira abertura', sent(r5.actions)[0] === cfg.steps[0].question, r5.actions)
}

// ─── CRM do lead: estágio só avança, resumo sai do estado ───────────────
{
  check('estágio: Lead novo -> Em contato', nextStatus('Lead novo', 'Em contato') === 'Em contato')
  check('estágio: sem status -> Em contato', nextStatus(null, 'Em contato') === 'Em contato')
  check('estágio: já em Em contato não regrava', nextStatus('Em contato', 'Em contato') === null)
  check('estágio: nunca volta (Interessado não vira Em contato)', nextStatus('Interessado', 'Em contato') === null)
  check('estágio: Em contato -> Interessado ao fim do roteiro', nextStatus('Em contato', 'Interessado') === 'Interessado')
  check('estágio: call marcada (Proposta enviada) não é rebaixada', nextStatus('Proposta enviada', 'Interessado') === null)
  check('estágio: recusa vira Perdido', nextStatus('Em contato', 'Perdido') === 'Perdido')
  check('estágio: recusa não derruba Proposta enviada', nextStatus('Proposta enviada', 'Perdido') === null)
  check('estágio: lead perdido que volta a responder reabre em Em contato', nextStatus('Perdido', 'Em contato') === 'Em contato')
  check('estágio: Fechado não muda', nextStatus('Fechado', 'Interessado') === null)

  const st = { ...initialState(), data: { nome: 'Isaías', ramo: 'transporte executivo', cidade: 'Barueri', tem_gmb: 'sim', decisor: 'nao' } }
  const resumo = buildResumo(cfg, st)
  check(
    'resumo do estado: linhas legíveis, sem artigo do rótulo',
    resumo.includes('- Nome: Isaías') && resumo.includes('- Ramo: transporte executivo') && resumo.includes('- Perfil do Google Meu Negócio: sim') && resumo.includes('- Quem decide: nao'),
    resumo
  )
  check('resumo vazio quando não há dado', buildResumo(cfg, initialState()) === '')
}

// ─── Nunca repetir a mesma pergunta (caso Francisco, "Masenaria Brasília") ─
{
  let s = turn(initialState(), read('outro'), { isFirstTurn: true }).state
  s = turn(s, read('resposta_passo', { nome: 'Francisco' })).state
  const r = turn(s, read('resposta_passo', { nome_empresa: 'Masenaria Brasília' }))
  const t = sent(r.actions)[0]
  check('só o nome da empresa veio: pergunta o que falta, não repete a pergunta idêntica', t === 'E o ramo e a cidade?' && t !== cfg.steps[1].question.replace('{nome}', 'Francisco'), t)
  const r2 = turn(s, read('outro'))
  check('nada respondido: repete a pergunta completa (só uma vez, depois passa pro humano)', sent(r2.actions)[0] === 'Francisco, qual o nome, o ramo e a cidade da sua empresa?', sent(r2.actions))
  const r3 = turn(r.state, read('resposta_passo', { ramo: 'marcenaria', cidade: 'Brasília' }))
  check('depois de responder o que faltava, segue pro Passo 2', sent(r3.actions)[0].startsWith('Você possui o perfil'), sent(r3.actions))
}

// ─── Link do perfil já responde "você tem?" (caso Isaías) ───────────────
{
  let s = turn(initialState(), read('outro'), { isFirstTurn: true }).state
  s = turn(s, read('resposta_passo', { nome: 'Isaías' })).state
  s = turn(s, read('resposta_passo', { ramo: 'transporte executivo', cidade: 'Barueri', nome_empresa: 'SC rádio táxi executivo' })).state
  const r = turn(s, read('resposta_passo', { gmb_link: 'https://share.google/hhtW3ZuXHTKffEvPD' }))
  check('mandou o link do perfil: conta como "tem perfil" e segue pro Passo 3', r.state.data.tem_gmb === 'sim' && sent(r.actions)[0] === 'Tem site?', { data: r.state.data, sent: sent(r.actions) })
  check('mandou o link: não pede o link de novo', !sent(r.actions).some((t) => t.includes('link ou print')), sent(r.actions))
  // mesmo caso, mas o link chegou num turno e o "sim/não" nunca veio: o próximo turno não repete a pergunta
  const semSimNao = { ...s, data: { ...s.data, gmb_link: 'https://share.google/x' } }
  const r2 = turn(semSimNao, read('outro'))
  check('link já guardado sem o sim/não: o próximo turno resolve sozinho', r2.state.data.tem_gmb === 'sim' && sent(r2.actions)[0] === 'Tem site?', sent(r2.actions))
}

// ─── Adiar : lead ocupado (caso Flávio, "tenho um curso agora") ────────
{
  const s = emQualificacao()
  const r1 = turn(s, read('adiar'))
  check('adiar: uma frase curta, sem pergunta, sem repetir a pergunta pendente', sent(r1.actions).length === 1 && sent(r1.actions)[0] === cfg.deferReply && !sent(r1.actions)[0].includes('?'), r1.actions)
  check('adiar: não gasta tentativa do passo nem muda o passo pendente', r1.state.asks.negocio === s.asks.negocio && r1.state.askedStep === s.askedStep, r1.state)
  const r2 = turn(r1.state, read('adiar'))
  check('adiar de novo sem o lead voltar: silêncio', has(r2.actions, 'silence'), r2.actions)
  const r3 = turn(r2.state, read('resposta_passo', { ramo: 'guincho', cidade: 'Piracicaba' }))
  check('lead volta e responde: o funil segue normal do passo pendente', sent(r3.actions)[0] === 'Você possui o perfil do Google Meu Negócio criado? Se sim, me manda o link ou um print dele.', sent(r3.actions))
  const r4 = turn(r3.state, read('adiar'))
  check('novo "ocupado" depois de voltar: responde de novo', sent(r4.actions)[0] === cfg.deferReply, r4.actions)
}
{
  const r = turn(initialState(), read('adiar'), { isFirstTurn: true })
  check('adiar na 1a mensagem vira abertura (não deixa o lead sem apresentação)', sent(r.actions)[0] === cfg.steps[0].question, r.actions)
}
{
  const semTexto = { ...cfg, deferReply: '' }
  const r = stepFunnel(semTexto, emQualificacao(), read('adiar'), { isFirstTurn: false, leadText: '' })
  check('adiar com texto vazio configurado: fica em silêncio', has(r.actions, 'silence') && sent(r.actions).length === 0, r.actions)
  const { deferReply: _omit, ...semChave } = cfg
  const r2 = stepFunnel(semChave as typeof cfg, emQualificacao(), read('adiar'), { isFirstTurn: false, leadText: '' })
  check('adiar sem texto configurado: usa o texto padrão, sem pergunta', sent(r2.actions).length === 1 && !sent(r2.actions)[0].includes('?'), r2.actions)
  const invalida = { ...cfg, deferReply: 'Quando você pode?' }
  check('validação recusa pergunta no texto de "ocupado"', validateFunnelConfig(invalida).some((e) => e.includes('ocupado')), validateFunnelConfig(invalida))
}

// ─── Dúvida de contexto ("Uque seria", caso Bafão 2026-09-21) ───────────
{
  // Lead recebeu o follow-up, respondeu "Opa / Bom dia / Uque seria": o funil precisa RESPONDER, não só re-perguntar o nome
  const s = turn(initialState(), read('outro'), { isFirstTurn: true }).state
  const r = turn(s, read('duvida_contexto'), { leadText: 'Opa\nBom dia\nUque seria' })
  const t = sent(r.actions)
  check('dúvida de contexto: explica antes de perguntar', t[0] === cfg.aboutReply, t)
  check('dúvida de contexto: depois da explicação, volta pra pergunta pendente (nome)', t[1] === 'Qual o seu nome?', t)
  const envio = r.actions[0] as Extract<FunnelAction, { type: 'send' }>
  check('dúvida de contexto: texto de explicação vai pra reescrita humana', envio.humanize?.kind === 'contexto', envio)
  const r2 = turn(r.state, read('duvida_contexto'), { leadText: 'não entendi' })
  check('2a dúvida ainda explica', sent(r2.actions)[0] === cfg.aboutReply, r2.actions)
  const r3 = turn(r2.state, read('duvida_contexto'), { leadText: 'mas o que é isso?' })
  check('3a dúvida: passa pra uma pessoa em vez de repetir a explicação', has(r3.actions, 'handoff') && r3.state.stage === 'handoff', r3.actions)
  const r4 = turn(initialState(), read('duvida_contexto'), { isFirstTurn: true })
  check('dúvida na 1a mensagem: é abertura, não repete apresentação', sent(r4.actions)[0] === cfg.steps[0].question && sent(r4.actions).length === 1, r4.actions)
  const semTexto = { ...cfg, aboutReply: undefined }
  const r5 = stepFunnel(semTexto, s, read('duvida_contexto'), { isFirstTurn: false, leadText: 'o que seria?' })
  check('sem texto configurado: consulta a base (nunca ignora)', r5.needBox === 'o que seria?', r5)
  check('validação recusa pergunta no texto de contexto', validateFunnelConfig({ ...cfg, aboutReply: 'Quer saber mais?' }).some((e) => e.includes('não entende')), validateFunnelConfig({ ...cfg, aboutReply: 'Quer saber mais?' }))
}

// ─── Nome: vocativo da equipe e correção (caso Elizeu "Oi Bruno") ────────
{
  const s = turn(initialState(), read('outro'), { isFirstTurn: true }).state
  const r = turn(s, read('resposta_passo', { nome: 'Bruno' }), { leadText: 'Oi Bruno' })
  check('"Oi Bruno" (nome da equipe) NÃO vira o nome do lead', r.state.data.nome === undefined, r.state.data)
  const r1 = turn(s, read('resposta_passo', { nome: 'Bruno' }), { leadText: 'Bom dia, Bruno! Tudo bem?' })
  check('"Bom dia, Bruno" também não', r1.state.data.nome === undefined, r1.state.data)
  const r2 = turn(s, read('resposta_passo', { nome: 'Bruno' }), { leadText: 'Bruno' })
  check('lead que se chama Bruno e responde só "Bruno" à pergunta de nome: aceito', r2.state.data.nome === 'Bruno', r2.state.data)
  const r3 = turn(s, read('resposta_passo', { nome: 'Bruno' }), { leadText: 'Oi Bruno, meu nome é Bruno também' })
  check('"meu nome é Bruno": aceito', r3.state.data.nome === 'Bruno', r3.state.data)
  // nome corrigido depois de já guardado (o passo do nome não é mais o pendente)
  let t = turn(s, read('resposta_passo', { nome: 'Elizeu' }), { leadText: 'Elizeu' }).state
  check('nome guardado', t.data.nome === 'Elizeu', t.data)
  const c = turn(t, read('resposta_passo', { nome: 'Eliseu' }), { leadText: 'na verdade é Eliseu com s' })
  check('lead corrige o nome por escrito: vale a correção', c.state.data.nome === 'Eliseu', c.state.data)
  const nc = turn(t, read('resposta_passo', { nome: 'Outro' }), { leadText: 'sim' })
  check('sem correção explícita o nome não é sobrescrito', nc.state.data.nome === 'Elizeu', nc.state.data)
}

// ─── Texto corrige o que veio de áudio ───────────────────────────────────
{
  let s = emQualificacao()
  s = turn(s, read('resposta_passo', { nome_empresa: 'Sarão de Ouro', ramo: 'salão', cidade: 'Jaú' })).state
  const sem = turn(s, read('resposta_passo', { nome_empresa: 'Outra Coisa' }), { leadText: 'sim' })
  check('sem correção: dado antigo mantido', sem.state.data.nome_empresa === 'Sarão de Ouro', sem.state.data)
  const com = turn(s, read('resposta_passo', { nome_empresa: 'Salão Tesoura de Ouro' }), { leadText: 'o certo é Salão Tesoura de Ouro' })
  check('lead corrige por escrito (áudio entendeu errado): a correção vale', com.state.data.nome_empresa === 'Salão Tesoura de Ouro', com.state.data)
}

// ─── Reperguntar com outras palavras ─────────────────────────────────────
{
  const s = turn(initialState(), read('outro'), { isFirstTurn: true }).state
  const r = turn(s, read('outro'), { leadText: 'kkk' })
  const envio = r.actions[0] as Extract<FunnelAction, { type: 'send' }>
  check('repetir a pergunta: vai pra reescrita humana', envio.humanize?.kind === 'reperguntar' && envio.humanize.script === 'Qual o seu nome?', envio)
  const primeira = turn(initialState(), read('outro'), { isFirstTurn: true })
  check('1a vez que pergunta: texto aprovado sem reescrita', !(primeira.actions[0] as Extract<FunnelAction, { type: 'send' }>).humanize, primeira.actions)
}

// ─── Planos em lista (não reescreve, sai palavra por palavra) ─────────────
{
  const r1 = turn(emQualificacao(), read('preco'))
  const r2 = turn(r1.state, read('preco'))
  const envio = r2.actions[0] as Extract<FunnelAction, { type: 'send' }>
  check('lista de planos: uma linha por plano', cfg.priceScripts[1].split('\n').length >= 5, cfg.priceScripts[1])
  check('lista de planos: sai palavra por palavra (sem reescrita)', envio.texts[0] === cfg.priceScripts[1] && !envio.humanize, envio)
  check('lista de planos: mantém os três valores', ['R$ 1.125', 'R$ 2.200', 'R$ 5.280'].every((v) => cfg.priceScripts[1].includes(v)))
}

// ─── Leitor: dúvida de contexto e correção no prompt ─────────────────────
{
  const p = buildReaderPrompt({ config: cfg, state: emQualificacao(), leadText: 'Uque seria', transcript: [], isFirstTurn: false })
  check('leitor conhece a categoria duvida_contexto', p.system.includes('duvida_contexto') && p.system.includes('uque seria'), '')
  const base = emQualificacao()
  const comRamo = { ...base, data: { ...base.data, ramo: 'barbearia' } }
  const p2 = buildReaderPrompt({ config: cfg, state: comRamo, leadText: 'na verdade é barbearia e salão', transcript: [], isFirstTurn: false })
  check('leitor vê campos já guardados só pra correção', p2.system.includes('Campos que já temos') && p2.system.includes('já guardado como "barbearia"'), '')
}

// ─── Não é bot: lead que pergunta ou conta algo é respondido (caso da neuropsicóloga, 2026-09-21) ─────
{
  const open = splitOpening(cfg.steps[0].question)
  check('abertura se divide em apresentação + pergunta', open.intro === 'Olá, tudo bem? Sou a Laura, atendente do Grupo Venda Marketing Digital.' && open.question === 'Qual o seu nome?', open)
  check('texto de uma frase só não se divide', splitOpening('Tem site?').intro === null)

  // 1a mensagem com pergunta "Como funciona?": responde entre a apresentação e a pergunta do nome
  const semBox = turn(initialState(), read('pergunta_fora', { ramo: 'neuropsicologia' }), { isFirstTurn: true, leadText: 'Como funciona? Sou Neuropsicóloga' })
  check('1a mensagem com pergunta: pede a caixa de conhecimento (não ignora)', semBox.needBox === 'Como funciona? Sou Neuropsicóloga', semBox)
  const r = turn(initialState(), read('pergunta_fora', { ramo: 'neuropsicologia' }), { isFirstTurn: true, leadText: 'Como funciona?', boxAnswer: 'O diagnóstico é uma conversa com o especialista em Google.' })
  check('1a mensagem com pergunta: apresentação, resposta, pergunta do nome (nessa ordem)', JSON.stringify(sent(r.actions)) === JSON.stringify([open.intro, 'O diagnóstico é uma conversa com o especialista em Google.', 'Qual o seu nome?']), sent(r.actions))
  check('1a mensagem com pergunta: dado que ela contou fica guardado', r.state.data.ramo === 'neuropsicologia' && r.state.askedStep === 'nome', r.state)
  const sem = turn(initialState(), read('pergunta_fora'), { isFirstTurn: true, leadText: 'Como funciona?', boxAnswer: null })
  check('1a mensagem com pergunta sem resposta na base: só a abertura (sem o texto de reserva solto)', sent(sem.actions).length === 1 && sent(sem.actions)[0] === cfg.steps[0].question && !sent(sem.actions).includes(cfg.unknownAnswer), sent(sem.actions))
  check('1a mensagem sem resposta na base: não conta falha da base nem passa pra pessoa', sem.state.offScriptFails === 0 && !has(sem.actions, 'handoff'), sem.state)
  const naoPrimeira = turn(emQualificacao(), read('pergunta_fora'), { leadText: 'x', boxAnswer: null })
  check('depois da 1a mensagem, sem resposta na base: continua usando o texto de reserva', sent(naoPrimeira.actions)[0] === cfg.unknownAnswer, sent(naoPrimeira.actions))
  check('1a mensagem que é preço continua virando abertura', sent(turn(initialState(), read('preco'), { isFirstTurn: true }).actions)[0] === cfg.steps[0].question)

  // Lead contou algo por conta própria: reconhecido
  const base = turn(initialState(), read('outro'), { isFirstTurn: true }).state // pendente: nome
  const depois = turn(base, read('resposta_passo', { ramo: 'neuropsicologia' }), { leadText: 'Sou Neuropsicóloga' })
  check('contou o ramo quando pedimos o nome: conta como espontâneo', leadVolunteered(cfg, base, depois.state, 'Sou Neuropsicóloga') === true)
  check('respondeu o nome que foi pedido: NÃO é espontâneo', leadVolunteered(cfg, base, turn(base, read('resposta_passo', { nome: 'Ana' }), { leadText: 'Ana' }).state, 'Ana') === false)
  check('mandou o Instagram sem ninguém pedir: espontâneo', leadVolunteered(cfg, base, base, 'Meu Instagram é @psicobemdiagnostico') === true)
  check('e-mail e link soltos também', leadVolunteered(cfg, base, base, 'https://meusite.com.br') === true)
  check('conversa comum sem dado nem link: não é espontâneo', leadVolunteered(cfg, base, base, 'kkk') === false)
  // Passo que pede o link: link é resposta, não espontâneo
  let s = turn(turn(initialState(), read('outro'), { isFirstTurn: true }).state, read('resposta_passo', { nome: 'Ana' })).state
  s = turn(s, read('resposta_passo', { ramo: 'barbearia', cidade: 'Salvador' })).state
  check('passo do perfil pendente: mandar o link é resposta, não espontâneo', s.askedStep === 'perfil_google' && leadVolunteered(cfg, s, s, 'https://share.google/x') === false, s.askedStep)

  const acoes = turn(base, read('resposta_passo'), { leadText: 'Meu Instagram é @x_y' }).actions
  check('reconhecimento espontâneo é liberado (mesmo com comentario false)', shouldReact({ state: base, reading: read('resposta_passo'), actions: acoes, isFirstTurn: false, enabled: true, volunteered: true }) === true)
  check('reconhecimento espontâneo respeita a chave "reações" desligada', shouldReact({ state: base, reading: read('resposta_passo'), actions: acoes, isFirstTurn: false, enabled: false, volunteered: true }) === false)
  check('sem espontâneo e sem relato: não reage (resposta seca segue natural)', shouldReact({ state: base, reading: read('resposta_passo'), actions: acoes, isFirstTurn: false, enabled: true }) === false)
  const aberturaAcoes = turn(initialState(), read('outro', { ramo: 'clínica' }), { isFirstTurn: true }).actions
  check('1a mensagem em que o lead contou algo: reconhecimento liberado', shouldReact({ state: initialState(), reading: read('outro'), actions: aberturaAcoes, isFirstTurn: true, enabled: true, volunteered: true }) === true)
  check('eco quando a frase do SDR é barrada: usa só os dados guardados', buildEcho(cfg, {}, { ramo: 'neuropsicologia' }, 'info') === 'Anotei: neuropsicologia.' && buildEcho(cfg, {}, {}, 'info') === 'Anotei, obrigada.')
}

// ─── Horário de hoje só com folga de 1 hora (decisão do Rodrigo, 2026-09-21) ─────
{
  const agora = new Date('2026-09-21T17:00:00Z').getTime() // 14:00 em Brasília
  check('folga: horário que já passou não é oferecido', isTooSoon(new Date('2026-09-21T15:00:00Z'), agora) === true)
  check('folga: começa em 30 minutos, não é oferecido', isTooSoon(new Date('2026-09-21T17:30:00Z'), agora) === true)
  check('folga: começa em 59 minutos, não é oferecido', isTooSoon(new Date('2026-09-21T17:59:00Z'), agora) === true)
  check('folga: começa em exatamente 1 hora, é oferecido', isTooSoon(new Date('2026-09-21T18:00:00Z'), agora) === false)
  check('folga: mais de 1 hora, é oferecido', isTooSoon(new Date('2026-09-21T18:30:00Z'), agora) === false)
  check('folga: amanhã sempre passa', isTooSoon(new Date('2026-09-22T12:00:00Z'), agora) === false)
  check('folga mínima é de 60 minutos', MIN_NOTICE_MINUTES === 60)
}

// ─── Modo conversa: o SDR troca ideia quando o lead sai do roteiro (caso Isaías, "faz um vídeo da pesquisa") ─────
{
  const s = emQualificacao() // pendente: negócio
  const r = turn(s, read('conversa'), { leadText: 'Faz um vídeo pra mim da pesquisa, porque eu pesquiso e aparece' })
  check('conversa: a máquina pede resposta livre do SDR (não pergunta o próximo passo por cima)', has(r.actions, 'converse') && sent(r.actions).length === 0, r.actions)
  check('conversa: não gasta tentativa do passo e mantém a pergunta pendente', r.state.asks.negocio === s.asks.negocio && r.state.askedStep === s.askedStep, r.state)
  let st = s
  let ultimo = r
  for (let i = 0; i < 4; i++) {
    ultimo = turn(st, read('conversa'))
    st = ultimo.state
  }
  check('conversa: até 4 turnos seguidos o SDR conversa', has(ultimo.actions, 'converse') && ultimo.state.converseStreak === 4, ultimo.state.converseStreak)
  const quinto = turn(st, read('conversa'))
  check('conversa: no 5o turno seguido passa pra uma pessoa (não roda em círculo)', has(quinto.actions, 'handoff') && quinto.state.stage === 'handoff', quinto.actions)
  const volta = turn(st, read('resposta_passo', { ramo: 'barbearia', cidade: 'Salvador' }))
  check('conversa: quando o lead volta a responder o roteiro, a contagem zera e o funil segue', volta.state.converseStreak === 0 && sent(volta.actions).length > 0, volta.state)
  check('conversa: na 1a mensagem vira abertura', sent(turn(initialState(), read('conversa'), { isFirstTurn: true }).actions)[0] === cfg.steps[0].question)
  const sched: FunnelState = { ...initialState(), stage: 'scheduling', data: { nome: 'Ana', ramo: 'x', cidade: 'y', tem_gmb: 'nao', tem_site: 'nao', fez_anuncio: 'nao', so_indicacao: 'nao', aparece_google: 'nao', decisor: 'sim' }, turns: 9 }
  check('conversa depois do roteiro: quem conversa é o orquestrador (agendamento)', has(turn(sched, read('conversa')).actions, 'delegate_scheduling'))
  check('leitor conhece a categoria conversa', buildReaderPrompt({ config: cfg, state: s, leadText: 'x', transcript: [], isFirstTurn: false }).system.includes('- conversa:'))

  // Conferência da resposta de conversa
  const corpus = 'Lead: Faz um vídeo da pesquisa. Eu pesquiso aqui e aparece. SC rádio táxi executivo'
  const ok = 'Entendi, Isaías. Que bom que aparece pra você quando pesquisa o nome da empresa.'
  check('conversa: resposta calma e curta passa na forma', structuralConversationChecks({ texto: ok, corpus, recentOutbound: [] }) === null)
  check('conversa: recusa valor, número inventado, duas perguntas e texto longo', structuralConversationChecks({ texto: 'Custa R$ 900.', corpus, recentOutbound: [] }) === 'tem_valor' && structuralConversationChecks({ texto: 'Temos 15 anos de mercado.', corpus, recentOutbound: [] }) === 'numero_inventado' && structuralConversationChecks({ texto: 'Pode ser? Quer ver?', corpus, recentOutbound: [] }) === 'perguntas_demais' && structuralConversationChecks({ texto: 'palavra '.repeat(80), corpus, recentOutbound: [] }) === 'longo_demais')
  check('conversa: recusa travessão, colchete e quebra de linha', structuralConversationChecks({ texto: 'Entendi — sim.', corpus, recentOutbound: [] }) === 'formato' && structuralConversationChecks({ texto: 'Veja [aqui].', corpus, recentOutbound: [] }) === 'formato' && structuralConversationChecks({ texto: 'Oi.\nTudo bem.', corpus, recentOutbound: [] }) === 'formato')
  check('conversa: recusa repetir o que acabamos de dizer', structuralConversationChecks({ texto: ok, corpus, recentOutbound: [ok] }) === 'repetida')
  const todosFalse = Object.fromEntries(CONVERSE_REVIEW_KEYS.map((k) => [k, false]))
  check('conversa: revisor com tudo false aprova', evaluateConverseReview(todosFalse).approved === true)
  check('conversa: "vou te mandar um vídeo" (promessa) é barrado', evaluateConverseReview({ ...todosFalse, promete_ou_garante_resultado_prazo_ou_entrega: true }).approved === false)
  check('conversa: "já pesquisamos o seu perfil" é barrado', evaluateConverseReview({ ...todosFalse, diz_que_viu_pesquisou_analisou_ou_verificou_algo_do_lead: true }).approved === false)
  check('conversa: "Passo 2 do fluxo" é barrado', evaluateConverseReview({ ...todosFalse, menciona_passo_fluxo_roteiro_ou_regra_interna: true }).approved === false)
  check('conversa: tom defensivo é barrado', evaluateConverseReview({ ...todosFalse, tom_defensivo_ou_discute_com_o_lead: true }).motivo === 'tom_defensivo_ou_discute_com_o_lead')
  const semChave: Record<string, unknown> = { ...todosFalse }
  delete semChave.cita_preco_ou_valor
  check('conversa: revisor com chave faltando reprova (falha fechada)', evaluateConverseReview(semChave).motivo === 'revisor_invalido' && evaluateConverseReview(undefined).approved === false)
}

// ─── Pergunta repetida: reformulação barrada não pode mandar a mesma pergunta de novo (caso Isaías, 68s) ─────
{
  const s = turn(initialState(), read('outro'), { isFirstTurn: true }).state
  const r = turn(s, read('outro'), { leadText: 'kkk' })
  const envio = r.actions[0] as Extract<FunnelAction, { type: 'send' }>
  check('reperguntar: a pergunta reescrevível vem marcada e com o texto aprovado (o runner evita idêntica recente)', envio.humanize?.kind === 'reperguntar' && envio.texts[0] === envio.humanize.script)
  check('reperguntar: o texto aprovado repetido é reconhecido como igual ao anterior', isRepeatOf(envio.texts[0], 'Qual o seu nome?') === true)
}

// ─── Sequência de etiqueta recomeça quando a etiqueta é reaplicada (lead de teste, Promoção) ─────
{
  const execs = [
    { lead_id: 1, step_id: 'a', disparado_em: '2026-09-18T14:07:00Z' },
    { lead_id: 1, step_id: 'b', disparado_em: '2026-09-18T14:08:00Z' },
    { lead_id: 1, step_id: 'fim', disparado_em: '2026-09-21T12:55:00Z' },
    { lead_id: 2, step_id: 'a', disparado_em: '2026-09-21T13:00:00Z' },
  ]
  const tag = new Map([[1, new Date('2026-09-21T12:40:00Z').getTime()], [2, new Date('2026-09-21T12:22:00Z').getTime()]])
  const f = firedStepsByLead(execs, tag)
  check('etiqueta reaplicada: envios de antes da etiqueta não contam (o passo pode disparar de novo)', !f.get(1)!.has('a') && !f.get(1)!.has('b'), [...f.get(1)!])
  check('etiqueta reaplicada: envio depois da etiqueta conta como já enviado nesta rodada', f.get(1)!.has('fim') && f.get(2)!.has('a'))
  const semEtiqueta = firedStepsByLead(execs, new Map())
  check('sequência sem etiqueta: tudo que já foi enviado continua contando', semEtiqueta.get(1)!.size === 3, [...semEtiqueta.get(1)!])
}

// ─── Entender o que a empresa enviou: áudio e imagem pelo ARQUIVO (caso Isaías, follow-up em áudio) ─────
{
  const audioNosso = { direcao: 'outbound', tipo_de_mensagem: 'ptt', url_da_midia: 'https://x.supabase.co/storage/audio.mp3', metadados: null }
  check('mídia nossa sem conteúdo entendido: precisa entender', needsUnderstanding(audioNosso) === true)
  check('mídia nossa já entendida: não repete (não gasta token)', needsUnderstanding({ ...audioNosso, metadados: { transcricao: '[Áudio que enviamos, dizia] oi' } }) === false)
  check('imagem nossa também é entendida', needsUnderstanding({ ...audioNosso, tipo_de_mensagem: 'image' }) === true)
  check('texto e mídia do lead não entram', needsUnderstanding({ ...audioNosso, tipo_de_mensagem: 'text' }) === false && needsUnderstanding({ ...audioNosso, direcao: 'inbound' }) === false)
  check('mídia sem arquivo acessível (carousel/menu em JSON) não entra', needsUnderstanding({ ...audioNosso, url_da_midia: '{"menuType":"button"}' }) === false && needsUnderstanding({ ...audioNosso, url_da_midia: null }) === false)

  // O texto órfão do editor NÃO é o que o áudio diz: a conversa usa a transcrição do arquivo
  const rows = [
    { texto_da_mensagem: '🎵 Áudio', direcao: 'outbound', sender_type: 'ai', metadados: { transcricao: '[Áudio que enviamos, dizia] Oi Isaías, tudo bem? Posso te ajudar com o seu perfil no Google?' }, carimbo_de_data_e_hora: '2026-09-21T15:00:20Z' },
    { texto_da_mensagem: '🎵 Áudio', direcao: 'inbound', sender_type: 'human', metadados: { transcricao: 'Não entendi' }, carimbo_de_data_e_hora: '2026-09-21T15:21:29Z' },
  ]
  const t = formatTranscript(rows)
  check('conversa: o que o nosso áudio dizia entra como fala da equipe, rotulado', t.some((l) => l.startsWith('Equipe (SDR): [Áudio que enviamos, dizia] Oi Isaías')), t)
  check('conversa: áudio do lead continua como antes', t.some((l) => l.startsWith('Lead: (por áudio ou imagem) Não entendi')), t)
}

// ─── Respostas da base: revisor barra vazamento de processo interno (caso Isaías, "Passo 2 do nosso fluxo") ─────
{
  const tudoFalse = Object.fromEntries(BOX_REVIEW_KEYS.map((k) => [k, false]))
  check('base: revisor com tudo false aprova', evaluateBoxReview(tudoFalse).approved === true)
  const vazou = evaluateBoxReview({ ...tudoFalse, menciona_passo_etapa_fluxo_roteiro_ou_regra_interna: true })
  check('base: menção a passo/fluxo interno é barrada, com o motivo', vazou.approved === false && vazou.motivo === 'menciona_passo_etapa_fluxo_roteiro_ou_regra_interna', vazou)
  check('base: resposta que não responde a pergunta é barrada', evaluateBoxReview({ ...tudoFalse, nao_responde_a_pergunta_do_lead: true }).approved === false)
  check('base: "já verificamos seu perfil" é barrado', evaluateBoxReview({ ...tudoFalse, diz_que_viu_analisou_ou_verificou_algo_do_lead: true }).approved === false)
  const faltando: Record<string, unknown> = { ...tudoFalse }
  delete faltando.promete_ou_garante_resultado
  check('base: revisor com chave faltando reprova (falha fechada)', evaluateBoxReview(faltando).motivo === 'revisor_invalido')
  check('base: revisor com valor que não é booleano reprova', evaluateBoxReview({ ...tudoFalse, nao_responde_a_pergunta_do_lead: 'false' }).approved === false)
  check('base: saída inválida reprova', evaluateBoxReview(null).approved === false && evaluateBoxReview('ok').approved === false)
  // A resposta que vazou passava na conferência de forma: por isso o revisor é necessário
  const ctx = 'Passo 2: pedir o link ou print do perfil Google para verificar. Depois seguimos para o próximo passo do diagnóstico.'
  check('base: a resposta que vazou passava na conferência de forma (só o revisor pega)', validateBoxAnswer('Já pedimos o link ou print do seu perfil Google no Passo 2 do nosso fluxo para verificar.', ctx) !== null)
}

// ─── Memória da conversa inteira (caso Isaías, 2026-09-21) ─────
{
  const rows = [
    { texto_da_mensagem: 'Hoje, você vive só de indicação e boca a boca?', direcao: 'outbound', sender_type: 'human', carimbo_de_data_e_hora: '2026-09-20T20:11:46Z' },
    { texto_da_mensagem: 'Bom trabalho fazendo campanha no Google ADS e indicação né', direcao: 'inbound', sender_type: 'human', carimbo_de_data_e_hora: '2026-09-20T20:12:28Z' },
    { texto_da_mensagem: 'Oi Isaías! Vi que você tinha começado...', direcao: 'outbound', sender_type: 'ai', carimbo_de_data_e_hora: '2026-09-21T15:00:20Z' },
    { texto_da_mensagem: '🎵 Áudio', direcao: 'inbound', sender_type: 'human', metadados: { transcricao: 'Não entendi, por que não tá aparecendo' }, carimbo_de_data_e_hora: '2026-09-21T15:21:29Z' },
    { texto_da_mensagem: '   ', direcao: 'inbound', sender_type: 'human', carimbo_de_data_e_hora: '2026-09-21T15:22:00Z' },
  ]
  const t = formatTranscript(rows)
  check('transcript: quem falou (pessoa da equipe, SDR e lead) fica claro', t.some((l) => l.startsWith('Equipe (pessoa): Hoje')) && t.some((l) => l.startsWith('Equipe (SDR): Oi Isaías')) && t.some((l) => l.startsWith('Lead: Bom trabalho')), t)
  check('transcript: marca a mudança de dia (resposta de ontem não parece de agora)', t.filter((l) => l.startsWith('--- ')).length === 2, t)
  check('transcript: áudio entra pelo que foi dito', t.some((l) => l.includes('(por áudio ou imagem) Não entendi, por que não tá aparecendo')), t)
  check('transcript: mensagem vazia não entra', countMessages(t) === 4, t)
  const longa = Array.from({ length: 300 }, (_, i) => ({ texto_da_mensagem: `msg ${i}`, direcao: 'inbound', carimbo_de_data_e_hora: '2026-09-21T15:00:00Z' }))
  check('transcript: conversa longa entra até o limite, das mais recentes', countMessages(formatTranscript(longa)) === 120 && formatTranscript(longa).some((l) => l.includes('msg 299')), '')

  // Evidência: o dado só vale se a prova está na conversa
  const conversa = t.join('\n')
  check('prova que está na conversa vale', evidenceOk('campanha no Google ADS e indicação', conversa) === true)
  check('prova inventada é recusada', evidenceOk('vivo só de indicação de amigos', conversa) === false)
  check('resposta curta ("Sim") vale quando está na conversa', evidenceOk('Sim', 'Lead: Sim, tenho site') === true)
  check('sem prova nenhuma é recusado', evidenceOk('', conversa) === false && evidenceOk(undefined, conversa) === false)

  const bruto = { categoria: 'resposta_passo', confianca: 0.9, dados: { so_indicacao: 'nao', tem_site: 'sim' }, evidencias: { so_indicacao: 'campanha no Google ADS e indicação' } }
  const lido = validateReading(bruto, cfg, conversa)
  check('leitor: dado com prova verificável fica, dado sem prova cai (e é registrado)', lido?.dados.so_indicacao === 'nao' && lido?.dados.tem_site === undefined && lido?.descartados?.[0] === 'tem_site', lido)
  const inventado = validateReading({ ...bruto, evidencias: { so_indicacao: 'texto que ninguém disse', tem_site: 'x' } }, cfg, conversa)
  check('leitor: prova inventada derruba o dado', inventado?.dados.so_indicacao === undefined, inventado)
  const legado = validateReading({ categoria: 'resposta_passo', confianca: 0.9, dados: { tem_site: 'sim' } }, cfg, conversa)
  check('leitor: resposta sem o campo de provas (formato antigo) continua funcionando', legado?.dados.tem_site === 'sim', legado)
  const semCorpus = validateReading(bruto, cfg)
  check('leitor: sem conversa pra conferir, não descarta nada', semCorpus?.dados.tem_site === 'sim', semCorpus)

  const pr = buildReaderPrompt({ config: cfg, state: emQualificacao(), leadText: 'x', transcript: t, isFirstTurn: false })
  check('leitor recebe a conversa inteira e a regra de prova', pr.user.includes('--- 20/09 ---') && pr.system.includes('evidencias') && pr.user.includes('Conversa completa'), '')

  // Memória: forma conferida em código
  const ok = { resumo: 'Isaías, dono da SC rádio táxi executivo em Barueri. Faz campanha no Google ADS e tem indicações. Perguntou por que não aparece no Google.', pendencias: ['Por que a empresa não aparece no Google'] }
  check('memória: texto factual passa na forma', structuralMemoryChecks(ok, conversa) === null)
  check('memória: recusa valor em reais, colchete e travessão', structuralMemoryChecks({ ...ok, resumo: 'Custa R$ 500.' }, conversa) === 'tem_valor' && structuralMemoryChecks({ ...ok, resumo: 'Tem [site].' }, conversa) === 'formato' && structuralMemoryChecks({ ...ok, resumo: 'Tem site — bom.' }, conversa) === 'formato')
  check('memória: recusa número que não está na conversa', structuralMemoryChecks({ ...ok, resumo: 'Tem 15 anos de mercado.' }, conversa) === 'numero_inventado')
  check('memória: recusa texto longo e pendências demais', structuralMemoryChecks({ ...ok, resumo: 'palavra '.repeat(140) }, conversa) === 'longo_demais' && structuralMemoryChecks({ ...ok, pendencias: ['a', 'b', 'c', 'd'] }, conversa) === 'pendencias_invalidas')
  check('memória: entra na ficha dos escritores e do orquestrador', formatMemoria(ok).length === 2 && buildFicha(cfg, emQualificacao(), ok).includes('Memória da conversa') && buildFicha(cfg, emQualificacao(), ok).includes('ainda sem resposta'), '')
  check('memória ausente: ficha igual à de antes', !buildFicha(cfg, emQualificacao()).includes('Memória da conversa'))

  // Pendência é do LEAD: pergunta que a EQUIPE fez não entra (caso Júnior)
  const conv2 = ['Lead: Oi, quero saber por que meu negócio não aparece no Google', 'Equipe (SDR): Qual o seu nome?', 'Equipe (SDR): Tem site?', 'Lead: Júnior']
  check('pendência: descarta pergunta que a equipe fez ao lead', dropOwnQuestions(['Qual o seu nome?', 'Tem site?'], conv2).length === 0)
  check('pendência: mantém a pergunta do próprio lead', dropOwnQuestions(['Por que meu negócio não aparece no Google', 'Tem site?'], conv2).join('|') === 'Por que meu negócio não aparece no Google')
  check('pendência: ignora acento e pontuação ao comparar', dropOwnQuestions(['qual o seu nome'], conv2).length === 0)
}

// ─── Duas intenções no mesmo lote: "valores || como funciona" (caso Willyman) ─────
{
  const s = emQualificacao()
  const dupla = read('preco', {}, { perguntaExtra: true })
  const pede = turn(s, dupla, { leadText: 'Gostaria de saber sobre valores || Como funciona' })
  check('duas intenções: consulta a base pra pergunta extra antes de responder', pede.needBox === 'Gostaria de saber sobre valores || Como funciona' && pede.actions.length === 0, pede)
  const r = turn(s, dupla, { leadText: 'x', boxAnswer: 'O diagnóstico é uma conversa com o especialista em Google.' })
  const t = sent(r.actions)
  check('duas intenções: responde o "como funciona" e depois o preço (nenhuma fica sem resposta)', t[0] === 'O diagnóstico é uma conversa com o especialista em Google.' && t[1] === cfg.priceScripts[0], t)
  const h = (r.actions[0] as Extract<FunnelAction, { type: 'send' }>).humanize
  check('duas intenções: a reescrita do preço aponta pro texto certo (não sobrescreve a resposta da base)', h?.kind === 'preco' && h.index === 1, h)
  check('duas intenções: o preço conta como perguntado (política de preço segue)', r.state.priceAsked === 1, r.state)
  const nula = turn(s, dupla, { leadText: 'x', boxAnswer: null })
  check('duas intenções sem resposta na base: segue só o preço, nada inventado', sent(nula.actions)[0] === cfg.priceScripts[0] && !nula.needBox, sent(nula.actions))
  const semExtra = turn(s, read('preco'), { leadText: 'quanto custa' })
  check('sem pergunta extra: comportamento normal (sem consulta à base)', !semExtra.needBox && sent(semExtra.actions)[0] === cfg.priceScripts[0], semExtra)
  const primeira = turn(initialState(), dupla, { isFirstTurn: true, leadText: 'x' })
  check('1a mensagem: pergunta extra não muda a abertura', !primeira.needBox && sent(primeira.actions)[0] === cfg.steps[0].question, primeira)
  const resp = turn(s, read('resposta_passo', { nome_empresa: 'Tecman', ramo: 'caça vazamento', cidade: 'São Paulo' }, { perguntaExtra: true }), { leadText: 'Tecman, caça vazamento, SP || como funciona?', boxAnswer: 'Funciona assim.' })
  check('resposta do passo + pergunta extra: responde e segue o funil', sent(resp.actions)[0] === 'Funciona assim.' && sent(resp.actions).length === 2, sent(resp.actions))
  const p = buildReaderPrompt({ config: cfg, state: s, leadText: 'valores || como funciona', transcript: [], isFirstTurn: false })
  check('leitor conhece pergunta_extra', p.system.includes('pergunta_extra'), '')
}

// ─── Fila por conversa: um turno por vez (caso Willyman, 2026-09-21) ─────
{
  const q = new ConversationQueue()
  const k = conversationKey(30, '5511915372811')
  check('fila: conversa livre é reservada', q.tryAcquire(k) === true)
  check('fila: segundo turno na mesma conversa espera (não roda junto)', q.tryAcquire(k) === false && q.isBusy(k))
  check('fila: outra conversa não é bloqueada', q.tryAcquire(conversationKey(30, '5521986694837')) === true)
  check('fila: mesmo telefone em outra empresa é outra conversa', q.tryAcquire(conversationKey(31, '5511915372811')) === true)
  const jobs = [
    { id: 1, company_id: 30, phone: '5511915372811' },
    { id: 2, company_id: 30, phone: '5500000000001' },
    { id: 3, company_id: 30, phone: '5500000000001' },
  ]
  const prontos = q.pickRunnable(jobs)
  check('fila: pula a conversa ocupada e não repete a mesma conversa no ciclo', prontos.length === 1 && prontos[0].id === 2, prontos)
  q.release(k)
  check('fila: ao terminar o turno a conversa volta a ser atendida', q.pickRunnable(jobs).map((j) => j.id).join() === '1,2', q.pickRunnable(jobs))
}

// ─── Validação da config (portão de salvar) ─────────────────────────────
{
  check('config do Grupo Venda é válida', validateFunnelConfig(cfg).length === 0, validateFunnelConfig(cfg))
  const gen = genericFunnelTemplate({ agentName: 'Bia', companyName: 'Loja X', humanName: 'a Carla' })
  check('modelo genérico é válido', validateFunnelConfig(gen).length === 0, validateFunnelConfig(gen))
  const bad = JSON.parse(JSON.stringify(cfg))
  bad.steps[1].question = 'Qual o ramo — e a cidade?'
  bad.priceScripts[0] = 'Custa R$ 500'
  bad.priceDisclosure = false
  bad.steps[2].followUp.missingField = 'nao_existe'
  const errs = validateFunnelConfig(bad)
  check('rejeita travessão, valor em reais e campo inexistente', errs.length >= 3, errs)
  check('rejeita config vazia', validateFunnelConfig({ version: 1, steps: [] }).length > 0)
}

console.log(failed === 0 ? '\nTodos passaram.' : `\n${failed} caso(s) falharam.`)
process.exit(failed === 0 ? 0 : 1)
