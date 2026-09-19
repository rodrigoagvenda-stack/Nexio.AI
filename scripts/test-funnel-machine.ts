/**
 * Testes da máquina de estados do funil (lib/sdr/funnel/machine.ts) com o
 * roteiro real do Grupo Venda. Sem banco, sem IA : a máquina é pura.
 * Rodar: npx tsx scripts/test-funnel-machine.ts
 */
import { stepFunnel } from '../lib/sdr/funnel/machine'
import { grupoVendaFunnel as cfg, genericFunnelTemplate } from '../lib/sdr/funnel/templates'
import { validateFunnelConfig } from '../lib/sdr/funnel/validate'
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
  const r1 = turn(emQualificacao(), read('preco'))
  const t = sent(r1.actions)
  check('preço 1a vez: script do Bruno + pergunta pendente, sem valor', t.length === 2 && t[0] === cfg.priceScripts[0] && t[1].includes('qual o nome, o ramo e a cidade') && !/R\$/.test(t.join(' ')), t)
  const r2 = turn(r1.state, read('preco'))
  check('preço 2a vez: passa pro Bruno na hora', has(r2.actions, 'handoff') && r2.state.stage === 'handoff' && sent(r2.actions).length === 0, r2.actions)
  const h = r2.actions.find((a) => a.type === 'handoff') as Extract<FunnelAction, { type: 'handoff' }>
  check('preço 2a vez: texto de espera do script aprovado', h.texts[0] === cfg.priceInsistHandoff, h.texts)
  const r3 = turn(r2.state, read('outro'))
  check('depois do handoff o funil fica em silêncio', has(r3.actions, 'silence'), r3.actions)
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

// ─── Validação da config (portão de salvar) ─────────────────────────────
{
  check('config do Grupo Venda é válida', validateFunnelConfig(cfg).length === 0, validateFunnelConfig(cfg))
  const gen = genericFunnelTemplate({ agentName: 'Bia', companyName: 'Loja X', humanName: 'a Carla' })
  check('modelo genérico é válido', validateFunnelConfig(gen).length === 0, validateFunnelConfig(gen))
  const bad = JSON.parse(JSON.stringify(cfg))
  bad.steps[1].question = 'Qual o ramo — e a cidade?'
  bad.priceScripts[0] = 'Custa R$ 500'
  bad.steps[2].followUp.missingField = 'nao_existe'
  const errs = validateFunnelConfig(bad)
  check('rejeita travessão, valor em reais e campo inexistente', errs.length >= 3, errs)
  check('rejeita config vazia', validateFunnelConfig({ version: 1, steps: [] }).length > 0)
}

console.log(failed === 0 ? '\nTodos passaram.' : `\n${failed} caso(s) falharam.`)
process.exit(failed === 0 ? 0 : 1)
