/**
 * SDR v3: extrator (spec seção 3). Uma chamada, structured output strict, temperature 0.
 * Só entende a mensagem: nunca decide nem escreve para o lead.
 */
import type OpenAI from 'openai'
import type { CompanyConfig } from './config-types'
import { INTENCOES, type Estado, type Extracao } from './types'

// Trocado de gpt-4.1 pra gpt-5.6-sol (30/09/2026, a pedido do Rodrigo): confirmado à mão no Playground da
// OpenAI (nome do modelo existe na conta, structured output com schema estrito aceito sem erro) antes de
// subir. MODELO_V3_FALLBACK é a rede de segurança: se o Sol falhar por qualquer motivo (nome mudar, ficar
// indisponível, parar de aceitar o schema), o turno cai pro modelo antigo na hora, sem derrubar o lead.
export const MODELO_V3 = 'gpt-5.6-sol'
export const MODELO_V3_FALLBACK = 'gpt-4.1'

/** Chama o modelo principal do v3; se falhar, cai pro fallback automaticamente, sem derrubar o turno.
 * `params` é tudo que chat.completions.create espera, menos o `model` (isso quem decide é esta função).
 * `max_tokens` e `temperature` também saem de fora: quem chama sempre passa do jeito "normal" (nome antigo
 * de token, temperature customizada), e esta função ajusta conforme o modelo. Achados reais em produção,
 * 01/10/2026: o Sol (gpt-5.6) rejeita `max_tokens` ("use max_completion_tokens") E rejeita qualquer
 * `temperature` diferente de 1, o padrão ("Only the default (1) value is supported") — mesmo padrão dos
 * modelos de raciocínio da OpenAI. O GPT-4.1 do fallback aceita os dois do jeito antigo normalmente. Sem
 * esse ajuste por modelo, toda chamada caía pro fallback e o Sol nunca rodava de verdade (o fallback segurou
 * a onda certinho, nenhum lead ficou sem resposta, mas o modelo novo nunca chegava a ser usado).
 *
 * 01/10/2026, 2º achado real: mesmo com max_completion_tokens alto, o Sol ainda podia devolver content vazio
 * ("Unexpected end of JSON input" no JSON.parse). Causa, confirmada na documentação da OpenAI: reasoning_effort
 * por padrão é "medium" pra modelo de raciocínio, e o raciocínio invisível consome do MESMO orçamento de
 * max_completion_tokens antes de gerar o JSON de resposta — em "medium" dá pra estourar o teto inteiro só
 * pensando, sem sobrar nada pro output. O Sol não aceita "none"/"minimal" (erro 400), só aceita a partir de
 * "low", que é o que usamos aqui: reduz o raciocínio invisível ao mínimo suportado por esse modelo. */
export async function chatV3(
  openai: OpenAI,
  params: Omit<OpenAI.Chat.ChatCompletionCreateParamsNonStreaming, 'model' | 'max_tokens' | 'max_completion_tokens' | 'temperature'> & { max_tokens?: number; temperature?: number },
  agente: string,
): Promise<OpenAI.Chat.ChatCompletion> {
  const { max_tokens, temperature, ...resto } = params
  const comModelo = (model: string): OpenAI.Chat.ChatCompletionCreateParamsNonStreaming =>
    ({
      ...resto,
      model,
      ...(model === MODELO_V3 ? { max_completion_tokens: max_tokens, reasoning_effort: 'low' } : { max_tokens, temperature }),
    }) as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming
  try {
    return await openai.chat.completions.create(comModelo(MODELO_V3))
  } catch (err: any) {
    console.error(`[SDR v3] ${agente}: ${MODELO_V3} falhou, caindo pro fallback (${MODELO_V3_FALLBACK}):`, err?.message)
    return await openai.chat.completions.create(comModelo(MODELO_V3_FALLBACK))
  }
}

export interface MsgHist {
  role: 'user' | 'assistant' | 'system'
  content: string
}

const SOCIAL_TIPOS = ['cumprimento', 'retribuicao_pedida', 'agradecimento', 'desabafo', 'humor', 'elogio', 'reclamacao']
const CAMPOS_FIXOS = ['nome', 'nome_completo', 'segmento', 'cidade', 'email', 'disponibilidade', 'cpf_cnpj']

export function camposDeDados(config: CompanyConfig): string[] {
  const escopo = config.preco.por_escopo?.campo
  const extras = config.qualificacao.perguntas.flatMap((q) => q.campos_extra?.map((c) => c.campo) ?? [])
  return [...new Set([...CAMPOS_FIXOS, ...config.qualificacao.perguntas.map((q) => q.campo), ...extras, ...(escopo ? [escopo] : [])])]
}

export function schemaExtracao(config: CompanyConfig) {
  const campos = camposDeDados(config)
  const ids = config.objecoes.map((o) => o.id)
  return {
    type: 'object',
    additionalProperties: false,
    required: ['intencoes', 'social', 'objecao_id', 'pergunta_fato', 'dados', 'horario_escolhido', 'tom_do_lead', 'confianca', 'resposta_automatica'],
    properties: {
      intencoes: { type: 'array', items: { type: 'string', enum: INTENCOES } },
      social: {
        anyOf: [
          { type: 'null' },
          {
            type: 'object',
            additionalProperties: false,
            required: ['tipo', 'texto_do_lead'],
            properties: { tipo: { type: 'string', enum: SOCIAL_TIPOS }, texto_do_lead: { type: 'string' } },
          },
        ],
      },
      objecao_id: ids.length ? { type: ['string', 'null'], enum: [...ids, null] } : { type: 'null' },
      pergunta_fato: { type: ['string', 'null'] },
      dados: {
        type: 'object',
        additionalProperties: false,
        required: campos,
        properties: Object.fromEntries(
          campos.map((c) => [c, c === config.preco.por_escopo?.campo ? { type: ['string', 'null'], enum: [...config.preco.por_escopo.opcoes.map((o) => o.valor), null] } : { type: ['string', 'null'] }]),
        ),
      },
      horario_escolhido: { type: ['string', 'null'] },
      tom_do_lead: { type: 'string', enum: ['curto_informal', 'informal', 'formal'] },
      confianca: { type: 'string', enum: ['alta', 'media', 'baixa'] },
      resposta_automatica: { type: 'boolean' },
    },
  }
}

export interface ContextoAutomacao {
  /** source gravado na mensagem: remarketing, antinoshow ou follow:<tipo>. */
  origem: string
  /** Texto (ou transcrição do áudio) que a automação mandou. */
  conteudo: string
}

function promptSistema(config: CompanyConfig, estado: Estado, agoraSp: string, automacao: ContextoAutomacao | null): string {
  const objecoes = config.objecoes
    .map((o) => `- ${o.id}: ${o.titulo}. Exemplos: ${o.gatilhos.map((g) => `"${g}"`).join('; ')}`)
    .join('\n')
  const tipoHint: Record<string, string> = { sim_nao: ' (responda "sim" ou "nao")', link_ou_print: ' (um link, ou "print enviado" se o lead mandou imagem)' }
  const perguntas = config.qualificacao.perguntas
    .map((q) => {
      const extras = (q.campos_extra ?? []).map((c) => `\n  também extraia campo "${c.campo}"${tipoHint[c.tipo] ?? ''}: ${c.descricao || c.label}`).join('')
      return `- campo "${q.campo}"${q.campo_tipo ? tipoHint[q.campo_tipo] ?? '' : ''}: ${q.texto.replace(/\{[^}]*\}/g, '').trim()}${extras}`
    })
    .join('\n')
  const pe = config.preco.por_escopo
  const escopo = pe
    ? `\nCampo "${pe.campo}" (o que o lead precisa; use SOMENTE um destes valores ou null):\n${pe.opcoes.map((o) => `- "${o.valor}": ${o.descricao}`).join('\n')}\nSó preencha quando o lead disser CLARAMENTE o que precisa (ex.: "só quero o Google", "quero site também", "os dois"). Citar o nome de um produto ou anúncio (ex.: "vi o anúncio do Google Meu Negócio") NÃO é resposta a isso: deixe null.\n`
    : ''
  return `Você só ENTENDE a mensagem de um lead de WhatsApp para a empresa ${config.persona.empresa}. Você não responde ao lead.
Data e hora agora (America/Sao_Paulo): ${agoraSp}.

Devolva as intenções da MENSAGEM ATUAL (uma mensagem pode ter várias, ex.: "tô bem e vc? sou dentista" = social + resposta_qualificacao):
- social: cumprimento, "tudo bem?", "e você?", agradecimento, desabafo, humor, elogio, reclamação
- pede_espera: "tô no carro", "já te respondo", "um minuto"
- resposta_qualificacao: respondeu ou informou algo da lista de campos abaixo
- pergunta_preco: PEDIU explicitamente valor, preço, quanto custa ou orçamento ("quanto custa?", "qual o valor?", "tem desconto?"). Citar um preço que ele viu em anúncio ou em outro lugar NÃO é pedir preço. Curiosidade genérica ("quero saber mais", "me interessei", "manda mais informações") também NÃO é: nesses casos NÃO marque pergunta_preco.
- objecao: trouxe uma das objeções da lista (informe objecao_id só com um id da lista)
- pergunta_como_funciona: PERGUNTOU explicitamente como o serviço funciona, o que a empresa faz ou como é o processo ("como funciona?", "o que vocês fazem?", "me explica o processo"). Curiosidade genérica ("quero saber mais", "me interessei", "vi o anúncio, me fala mais") NÃO conta: nesses casos NÃO marque pergunta_como_funciona, é só abertura de conversa (deixe a qualificação normal seguir). A frase de abertura do próprio anúncio, ex. "Vi o anúncio e quero saber por que meu negócio não aparece no Google" (ou variações), é só o gancho que trouxe o lead pra conversa, não é pedido de explicação nem de preço: NUNCA marque pergunta_como_funciona nem pergunta_preco só por causa dela, mesmo que pareça uma pergunta com "por que" ou "como". Mesmo que a mensagem também pergunte o preço de verdade (com outras palavras, além da frase do anúncio), marque as duas.
- pergunta_fato: outra dúvida sobre a empresa ou os planos (escreva a dúvida como consulta em pergunta_fato)
- quer_agendar: quer marcar reunião ou conversa
- escolheu_horario: escolheu ou propôs dia/horário (preencha horario_escolhido em ISO 8601 sem fuso, ex. 2026-09-30T14:00:00; se ele escolheu entre os horários oferecidos, use exatamente um deles)
- informou_email: passou o e-mail
- pede_ligacao: quer que liguem ou prefere ligação
- pede_remarcar: já tem reunião marcada e pede pra MUDAR pra outro dia/horário, sem dizer explicitamente "cancelar" ("não vou poder nesse horário", "pode remarcar?", "vou faltar, tem outro horário?", "preciso adiar")
- cancela_reuniao: já tem reunião marcada e pede EXPLICITAMENTE pra cancelar, sem quere remarcar agora ("quero cancelar", "cancela minha reunião", "não quero mais", "pode cancelar, depois eu remarco"). Diferente de pede_remarcar: aqui o lead não quer ver outros horários agora, só cancelar. Se ele disser "cancela" mas também já der um novo dia/horário na mesma mensagem, marque as duas: cancela_reuniao E escolheu_horario.
- pede_humano: quer falar com uma pessoa, atendente ou o responsável
- pergunta_se_e_robo: pergunta se é robô, IA, bot ou pessoa
- recusa: disse que não quer, não tem interesse, para de mandar mensagem
- fora_do_escopo: pede algo que a empresa não faz
- pede_pagamento: quer pagar, pede link, boleto, PIX ou chave de pagamento
- outro: nenhuma das anteriores ou não deu para entender

Objeções da empresa (use só estes ids):
${objecoes || '(nenhuma)'}

Campos de qualificação e as perguntas que os preenchem:
${perguntas}
${escopo}
REGRAS
- "dados" recebe SOMENTE o que o LEAD disse em qualquer mensagem do trecho abaixo. Nada inferido, nada que o agente tenha escrito, nada do nome de perfil do WhatsApp. Uma resposta curta ("sim", "não", "sou eu") vale para a pergunta que o agente acabou de fazer. Campo sem informação = null.
- A primeira mensagem do lead costuma ser o texto fixo do próprio anúncio (ex.: "Vi o anúncio e quero saber por que meu negócio não aparece no Google"), igual para todo mundo que clicou, não uma frase que ele escreveu sobre a empresa dele. NUNCA preencha nenhum campo de dados a partir dessa frase de gancho (ex.: NÃO preencha "aparece no Google" como "nao" só porque essa é a frase padrão do anúncio): só preenche quando o lead disser isso com as próprias palavras, fora do gancho do anúncio.
- Para o campo "negocio": preencha com o que o lead disse do negócio (nome, ramo, cidade) em uma frase curta. Preencha também segmento e cidade quando ele disse.
- Para os campos de sim ou não (perfil no Google, decisor, site, anúncio, indicação): responda "sim" ou "nao" e, se ele deu detalhe (link, print, nome da pessoa), acrescente depois de dois-pontos. Print ou link enviado como resposta a "tem perfil no Google?" vale "sim".
- nome_completo só quando o lead deu nome e sobrenome.
- tom_do_lead: curto_informal (poucas palavras, abreviações), informal, ou formal.
- confianca: baixa quando você não tem certeza do que o lead quis dizer.
- resposta_automatica: true só quando é claramente mensagem automática de sistema (menu numerado "digite 1 para...", mensagem de ausência, "em breve retornaremos", "nosso horário de atendimento é...", "obrigado por entrar em contato com a empresa X"). Uma pessoa contando do próprio negócio ("somos uma clínica", "trabalho com estética") NÃO é resposta automática: é resposta_qualificacao.
- disponibilidade: preencha quando o lead diz dia, período ou horário em que pode ou não pode ("de manhã não dá", "só à tarde", "depois das 18h", "hoje não consigo"), com as palavras dele.
- Se o agente ofereceu horários, os oferecidos foram: ${estado.dados._slots ? estado.dados._slots : 'nenhum'}.${
    automacao
      ? `
- CONTEXTO IMPORTANTE: a última mensagem que NÓS mandamos foi uma automação (${automacao.origem}: follow-up, remarketing, promoção ou lembrete de reunião), não uma pergunta do agente. Ela dizia: "${automacao.conteudo.slice(0, 900)}". A mensagem atual do lead é a resposta a ISSO. Se o lead recusa, diz que não quer, não tem interesse, ou responde com "ok"/"tá bom"/"obrigado" de forma que encerra o assunto sem demonstrar interesse (principalmente quando a automação avisava que ia parar de chamar ou pedia pra avisar se não tivesse interesse), marque recusa. Se ele demonstra interesse ou pergunta algo, classifique normalmente.`
      : ''
  }`
}

const fmtHist = (h: MsgHist[]) => h.map((m) => `${m.role === 'assistant' ? 'Agente' : 'Lead'}: ${m.content}`).join('\n')

export async function extrair(
  openai: OpenAI,
  p: { config: CompanyConfig; estado: Estado; historico: MsgHist[]; mensagemAtual: string; contextoAutomacao?: ContextoAutomacao | null },
  onUsage?: (c: OpenAI.Chat.ChatCompletion, agent: string) => void,
): Promise<Extracao> {
  const agoraSp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  const completion = await chatV3(openai, {
    temperature: 0,
    max_tokens: 2000,
    response_format: { type: 'json_schema', json_schema: { name: 'extracao', strict: true, schema: schemaExtracao(p.config) as any } },
    messages: [
      { role: 'system', content: promptSistema(p.config, p.estado, agoraSp, p.contextoAutomacao ?? null) },
      { role: 'user', content: `TRECHO DA CONVERSA:\n${fmtHist(p.historico)}\n\nMENSAGEM ATUAL DO LEAD (é a que você classifica):\n${p.mensagemAtual}` },
    ],
  }, 'extrator')
  onUsage?.(completion, 'v3_extrator')
  const raw = JSON.parse(completion.choices[0]?.message?.content || '{}')
  const dados: Record<string, string> = {}
  for (const [k, v] of Object.entries((raw.dados ?? {}) as Record<string, string | null>)) if (typeof v === 'string' && v.trim()) dados[k] = v.trim()
  const ids = new Set(p.config.objecoes.map((o) => o.id))
  const extracao: Extracao = {
    intencoes: Array.isArray(raw.intencoes) && raw.intencoes.length ? raw.intencoes : ['outro'],
    social: raw.social ?? null,
    objecao_id: raw.objecao_id && ids.has(raw.objecao_id) ? raw.objecao_id : null,
    pergunta_fato: raw.pergunta_fato ?? null,
    dados,
    horario_escolhido: raw.horario_escolhido ?? null,
    tom_do_lead: raw.tom_do_lead ?? 'informal',
    confianca: raw.confianca ?? 'media',
    resposta_automatica: raw.resposta_automatica === true,
  }
  return extracao
}
