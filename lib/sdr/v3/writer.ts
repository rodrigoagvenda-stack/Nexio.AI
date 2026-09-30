/**
 * SDR v3: redator (spec seção 5). gpt-4.1, temperature 0.7. Só escreve o que a Acao manda: não decide nada.
 * "regras_redator" da config é só estilo; regra de negócio é conferida pelo validador.
 */
import type OpenAI from 'openai'
import type { CompanyConfig } from './config-types'
import { chatV3, type MsgHist } from './extractor'
import type { Acao } from './types'
import type { Violacao } from './validator'

const TOM: Record<Acao['tom_do_lead'], string> = {
  curto_informal: 'curto e informal (mensagem curta, jeito de conversa rápida)',
  informal: 'informal e natural',
  formal: 'cordial e mais formal, sem gírias',
}

const asList = (t: string | string[]) => (Array.isArray(t) ? t : [t])

function descreverAcao(a: Acao, soReacao: boolean): string {
  if (soReacao) return 'Escreva SOMENTE uma reação social curta ao que o lead disse (1 frase, sem pergunta, sem oferecer nada). Outro conteúdo será enviado separadamente pelo sistema.'
  const linhas: string[] = []
  switch (a.tipo) {
    case 'aguardar':
      linhas.push('O lead pediu um tempo ou não há o que perguntar agora. Responda só com reação social curta e acolhedora. NÃO faça pergunta.')
      break
    case 'perguntar':
      linhas.push('Faça a pergunta abaixo, com suas palavras.')
      break
    default:
      break
  }
  if (a.conteudo) {
    const blocos = asList(a.conteudo.texto)
    if (a.conteudo.modo === 'literal') {
      linhas.push(`Envie EXATAMENTE este conteúdo, sem mudar nenhuma palavra${blocos.length > 1 ? ` (cada item é um bloco separado, na ordem)` : ''}:\n${blocos.map((b, i) => `[${i + 1}] ${b}`).join('\n')}`)
    } else {
      linhas.push(`Diga o mesmo que o conteúdo abaixo, com suas palavras, sem acrescentar nem tirar informação${blocos.length > 1 ? ' (mantenha os blocos separados)' : ''}:\n${blocos.map((b, i) => `[${i + 1}] ${b}`).join('\n')}`)
    }
  }
  if (a.tipo === 'responder_fato' && a.consulta_rag) {
    linhas.push(`O lead perguntou: "${a.consulta_rag}". Responda essa dúvida de verdade, em 1 a 2 frases com os fatos abaixo, ANTES de qualquer pergunta. Nunca responda só com cumprimento ou apresentação: ignorar a dúvida do lead é o pior erro.`)
  }
  if (a.fatos.length > 0) {
    linhas.push(
      `Fatos disponíveis (use só o que responde à dúvida do lead; se eles não respondem, diga que o especialista responde melhor e chame-o pelo nome, sem inventar):\n${a.fatos.map((f) => `- ${f.texto}`).join('\n')}`,
    )
  }
  const literalTerminaEmPergunta = a.conteudo?.modo === 'literal' && asList(a.conteudo.texto).join(' ').includes('?')
  if (a.proxima_pergunta) {
    linhas.push(`${a.conteudo || a.fatos.length ? 'Depois, termine com' : 'Pergunta de referência'} (uma única pergunta, no fim): "${a.proxima_pergunta.texto}"`)
    linhas.push('Essa é a ÚNICA pergunta da mensagem. Não crie outra pergunta antes dela (nem de ponte, nem pedindo dado que faltou), nem devolva "e você?".')
    if (a.conteudo?.modo === 'literal') {
      linhas.push('A pergunta é SEMPRE o ÚLTIMO bloco da lista, sozinho, nunca colada na última frase do conteúdo exato (nem com quebra de linha, nem com "Mas..."): o conteúdo exato mantém seus blocos originais intactos, e a pergunta soma mais um bloco no fim.')
    }
  } else if (literalTerminaEmPergunta) {
    linhas.push('O conteúdo exato já termina com a pergunta desta mensagem: não faça nenhuma outra pergunta, nem "tudo bem?" ou "e você?".')
  } else {
    linhas.push('Não faça nenhuma pergunta nesta mensagem.')
  }
  for (const c of a.contexto) linhas.push(`Contexto: ${c}`)
  return linhas.join('\n')
}

export function promptRedator(config: CompanyConfig, acao: Acao, soReacao: boolean): string {
  const p = config.persona
  const regras = (config.regras_redator ?? []).map((r) => `- ${r}`).join('\n')
  const nunca = (config.nunca_prometer ?? []).map((r) => `- ${r}`).join('\n')
  const termos = (config.validador?.terminologia ?? []).map((t) => `- Diga "${t.usar}", não "${t.evitar}"${t.excecao ? ` (exceção: ${t.excecao})` : ''}.`).join('\n')
  const social = acao.reacao_social && acao.social
    ? `Reação social do lead (${acao.social.tipo}): "${acao.social.texto_do_lead}". Responda a ela primeiro, como uma pessoa faria. Se perguntou "tudo bem?" ou "e você?", diga que está bem, com naturalidade, sem devolver a pergunta. Se agradeceu, receba o agradecimento. Se desabafou, reconheça antes de seguir.`
    : 'Não há reação social a responder.'
  return `Você é ${p.nome_agente}, do ${p.empresa}, conversando no WhatsApp.
Escreva como uma pessoa real escreveria, no tom ${p.tom}. Fale no gênero de quem você é (ex.: uma Laura diz "obrigada", nunca "obrigado").

O que fazer neste turno:
${descreverAcao(acao, soReacao)}

${social}

Regras de escrita:
- Espelhe o lead: ${TOM[acao.tom_do_lead]}. Lead curto e informal recebe mensagem curta e informal.
- Conteúdo "exatamente": envie sem mudar. Conteúdo "com suas palavras": diga o mesmo sem acrescentar nada.
- Use só os fatos fornecidos. Não acrescente número, prazo, preço, nome de cliente ou promessa.
- Não afirme o que não está no conteúdo, nos fatos ou no que o lead escreveu: nada de "vi seu perfil", "analisei seu negócio", "já ajudamos empresas como a sua", resultado, diagnóstico ou dado sobre o lead. Comentário genérico e curto sobre o ramo é permitido ("dentista costuma ser bem procurado no Google").- No máximo uma pergunta, sempre no fim.
- 1 a 3 frases por bloco, no máximo 2 blocos (respeite mais blocos quando o conteúdo exato vier em vários, e mais um bloco quando houver pergunta no fim de conteúdo exato de 2 blocos).
- Não comece com "Entendi", "Perfeito", "Ótimo" se você já usou isso nas últimas mensagens.
- Não repita o que o lead disse. Não elogie a pergunta. Não justifique por que está perguntando.
- Não use travessão. Não use colchetes.
- Nunca negue ser uma assistente automatizada se perguntarem.
${termos ? `\nVocabulário:\n${termos}` : ''}
${nunca ? `\nNunca prometa:\n${nunca}` : ''}
${regras ? `\nEstilo:\n${regras}` : ''}

Devolva JSON: {"blocos": string[], "fatos_usados": string[]}`
}

export interface RedatorResultado {
  blocos: string[]
  fatos_usados: string[]
}

export async function redigir(
  openai: OpenAI,
  p: {
    config: CompanyConfig
    acao: Acao
    historico: MsgHist[]
    frasesEnviadas: string[]
    soReacao?: boolean
    violacoes?: Violacao[]
    anterior?: string[]
  },
  onUsage?: (c: OpenAI.Chat.ChatCompletion, agent: string) => void,
): Promise<RedatorResultado> {
  const hist = p.historico.slice(-6).map((m) => `${m.role === 'assistant' ? 'Você' : 'Lead'}: ${m.content}`).join('\n')
  // Alinhado com o que o validador (V3) de fato compara (até as últimas 30 frases, ver salvarEstado em
  // state.ts): uma janela bem menor aqui fazia o redator achar uma frase seguro repetir, e o validador
  // barrar do mesmo jeito — regeneração desperdiçada.
  const evitar = p.frasesEnviadas.slice(-20)
  const user =
    `Últimas mensagens:\n${hist}\n` +
    (evitar.length ? `\nFrases que você já enviou nesta conversa (não repita):\n${evitar.map((f) => `- ${f}`).join('\n')}\n` : '') +
    (p.violacoes?.length
      ? `\nSua versão anterior foi recusada:\n${(p.anterior ?? []).map((b) => `> ${b}`).join('\n')}\nMotivos: ${p.violacoes.map((v) => `${v.regra} (${v.detalhe})`).join('; ')}.\nReescreva corrigindo isso.`
      : '')
  const completion = await chatV3(openai, {
    temperature: 0.7,
    max_tokens: 2000,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'resposta',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['blocos', 'fatos_usados'],
          properties: { blocos: { type: 'array', items: { type: 'string' } }, fatos_usados: { type: 'array', items: { type: 'string' } } },
        },
      },
    },
    messages: [
      { role: 'system', content: promptRedator(p.config, p.acao, p.soReacao === true) },
      { role: 'user', content: user },
    ],
  }, 'redator')
  onUsage?.(completion, 'v3_redator')
  const raw = JSON.parse(completion.choices[0]?.message?.content || '{}')
  const blocos = (Array.isArray(raw.blocos) ? raw.blocos : []).map((b: unknown) => String(b).trim()).filter(Boolean)
  return { blocos, fatos_usados: Array.isArray(raw.fatos_usados) ? raw.fatos_usados.map(String) : [] }
}
