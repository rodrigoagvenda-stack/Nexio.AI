/**
 * Teste da guarda de saída do SDR com transcrições reais (Mara, Donato, Rita,
 * Anderson). Rodar: npx tsx scripts/test-output-guard.ts
 * Sai com código 1 se algum caso falhar.
 */
import { guardOutput, type GuardContext } from '../lib/sdr/output-guard'

let failed = 0

function ctx(over: Partial<GuardContext> = {}): GuardContext {
  return { recentOutbound: [], firstOutbound: [], totalOutbound: 0, gratuitoCount: 0, ...over }
}

function check(name: string, ok: boolean, detail?: unknown) {
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
  if (!ok && detail !== undefined) console.log('      ', JSON.stringify(detail))
}

// ─── Deve cortar / corrigir ─────────────────────────────────────────────

{
  const r = guardOutput(
    ['Você possui o perfil do Google Meu Negócio criado?', 'Qual o ramo da sua empresa e em qual cidade ela atua?'],
    ctx(),
  )
  check('R1: duas perguntas na rajada -> só a primeira', r.paragraphs.length === 1 && r.paragraphs[0].startsWith('Você possui'), r)
}

{
  const r = guardOutput(['Entendi, obrigada por explicar.', 'Assim já começo a entender melhor seu cenário e te direciono pro próximo passo.'], ctx())
  check('R3: "Assim já começo..." removida', r.paragraphs.length === 1 && r.paragraphs[0].startsWith('Entendi'), r)
}

{
  const r = guardOutput(['Qual o seu nome, por favor? Assim já seguimos pra entender melhor seu caso.'], ctx())
  check('R3: justificativa emendada removida, pergunta mantida', r.paragraphs[0] === 'Qual o seu nome, por favor?', r)
}

{
  const r = guardOutput(['Pra te direcionar certinho, qual o nome, o ramo e a cidade da sua empresa?'], ctx())
  check('R3: prefixo "Pra te direcionar certinho," cortado', r.paragraphs[0] === 'Qual o nome, o ramo e a cidade da sua empresa?', r)
}

{
  const r = guardOutput(['Isso me ajuda a entender o seu momento. Você já tem site?'], ctx())
  check('R3: "Isso me ajuda..." removida', r.paragraphs[0] === 'Você já tem site?', r)
}

{
  const opening = ['Oi! Sou a Laura, especialista em presença digital do Grupo Venda.', 'Como posso te chamar?']
  const r = guardOutput(['Oi! Sou a Laura, especialista em presença digital do Grupo Venda.'], ctx({ firstOutbound: opening, totalOutbound: 9 }))
  check('R2b: reapresentação depois da abertura vira silêncio', r.paragraphs.length === 0, r)
}

{
  const opening = ['Oi! Sou a Laura, especialista em presença digital do Grupo Venda.', 'Como posso te chamar?']
  const r = guardOutput(['Oi! Sou a Laura, especialista em presença digital do Grupo Venda.'], ctx({ firstOutbound: opening, totalOutbound: 1 }))
  check('R2b: não atua nas primeiras mensagens', r.paragraphs.length === 1, r)
}

{
  const prev = 'Posso verificar os horários disponíveis pra você?'
  const r = guardOutput(['Perfeito, Donato!', 'Posso verificar os horários disponíveis pra você?'], ctx({ recentOutbound: [prev] }))
  check('R2a: pergunta repetida removida, resto mantido', r.paragraphs.length === 1 && r.paragraphs[0] === 'Perfeito, Donato!', r)
}

{
  const prev = 'Posso verificar os horários disponíveis pra você?'
  const r = guardOutput(['Posso verificar os horários disponíveis pra você conversar com o Bruno?'], ctx({ recentOutbound: [prev] }))
  check('R2a: mesma frase com rabicho novo cai como repetição, mas não esvazia a rajada', r.paragraphs.length === 1, r)
}

{
  const r = guardOutput(['O plano começa em R$ 1.125 por mês. Vamos agendar uma conversa com o Bruno?'], ctx({ rules: { blockPrice: true } }))
  check('R4: preço removido, pergunta mantida', r.paragraphs[0] === 'Vamos agendar uma conversa com o Bruno?', r)
}

{
  const r = guardOutput(['A análise é gratuita e sem custo. Qual o seu ramo?'], ctx({ gratuitoCount: 1, rules: { maxGratuito: 1 } }))
  check('R4: excesso de "gratuito" removido', r.paragraphs[0] === 'Qual o seu ramo?', r)
}

// ─── Não pode quebrar ───────────────────────────────────────────────────

{
  const t = 'Assim que finalizar, me avisa aqui pra eu te passar os próximos passos!'
  const r = guardOutput([t], ctx())
  check('mantém "Assim que finalizar..." (instrução, não justificativa)', r.paragraphs[0] === t && r.violations.length === 0, r)
}

{
  const t = 'Você possui o perfil do Google Meu Negócio criado? Se sim, me manda o link ou um print dele.'
  const r = guardOutput([t], ctx())
  check('mantém pergunta verbatim do Passo 2', r.paragraphs[0] === t && r.violations.length === 0, r)
}

{
  const t = 'Perfeito, Donato! Obrigada por confirmar.'
  const r = guardOutput([t], ctx())
  check('mantém confirmação simples', r.paragraphs[0] === t && r.violations.length === 0, r)
}

{
  const r = guardOutput(['Oi, tudo bem?', 'Como posso te chamar?'], ctx())
  check('"Tudo bem?" de abertura não conta como pergunta de qualificação', r.paragraphs.length === 2, r)
}

{
  const r = guardOutput(['Valor por mês: R$ 1.125'], ctx())
  check('preço passa quando a empresa não ativou blockPrice', r.paragraphs.length === 1, r)
}

{
  const r = guardOutput(['Fechado!', 'Vou verificar a agenda do Bruno.'], ctx({ recentOutbound: ['Fechado!'] }))
  check('resposta curta repetida ("Fechado!") não é tratada como repetição', r.paragraphs.length === 2, r)
}

console.log(failed === 0 ? '\nTodos passaram.' : `\n${failed} caso(s) falharam.`)
process.exit(failed === 0 ? 0 : 1)
