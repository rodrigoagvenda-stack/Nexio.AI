/**
 * SDR v3: extrator (spec seção 3). Uma chamada, structured output strict, temperature 0.
 * Só entende a mensagem: nunca decide nem escreve para o lead.
 */
import type OpenAI from 'openai'
import type { CompanyConfig } from './config-types'
import { INTENCOES, type Estado, type Extracao } from './types'

export const MODELO_V3 = 'gpt-4.1'

export interface MsgHist {
  role: 'user' | 'assistant' | 'system'
  content: string
}

const SOCIAL_TIPOS = ['cumprimento', 'retribuicao_pedida', 'agradecimento', 'desabafo', 'humor', 'elogio', 'reclamacao']
const CAMPOS_FIXOS = ['nome', 'nome_completo', 'segmento', 'cidade', 'email', 'disponibilidade', 'cpf_cnpj']

export function camposDeDados(config: CompanyConfig): string[] {
  return [...new Set([...CAMPOS_FIXOS, ...config.qualificacao.perguntas.map((q) => q.campo)])]
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
        properties: Object.fromEntries(campos.map((c) => [c, { type: ['string', 'null'] }])),
      },
      horario_escolhido: { type: ['string', 'null'] },
      tom_do_lead: { type: 'string', enum: ['curto_informal', 'informal', 'formal'] },
      confianca: { type: 'string', enum: ['alta', 'media', 'baixa'] },
      resposta_automatica: { type: 'boolean' },
    },
  }
}

function promptSistema(config: CompanyConfig, estado: Estado, agoraSp: string): string {
  const objecoes = config.objecoes
    .map((o) => `- ${o.id}: ${o.titulo}. Exemplos: ${o.gatilhos.map((g) => `"${g}"`).join('; ')}`)
    .join('\n')
  const perguntas = config.qualificacao.perguntas
    .map((q) => `- campo "${q.campo}": ${q.texto.replace(/\{[^}]*\}/g, '').trim()}`)
    .join('\n')
  return `Você só ENTENDE a mensagem de um lead de WhatsApp para a empresa ${config.persona.empresa}. Você não responde ao lead.
Data e hora agora (America/Sao_Paulo): ${agoraSp}.

Devolva as intenções da MENSAGEM ATUAL (uma mensagem pode ter várias, ex.: "tô bem e vc? sou dentista" = social + resposta_qualificacao):
- social: cumprimento, "tudo bem?", "e você?", agradecimento, desabafo, humor, elogio, reclamação
- pede_espera: "tô no carro", "já te respondo", "um minuto"
- resposta_qualificacao: respondeu ou informou algo da lista de campos abaixo
- pergunta_preco: quer saber valor, preço, quanto custa, orçamento
- objecao: trouxe uma das objeções da lista (informe objecao_id só com um id da lista)
- pergunta_fato: dúvida sobre a empresa, os planos, o processo (escreva a dúvida como consulta em pergunta_fato)
- quer_agendar: quer marcar reunião ou conversa
- escolheu_horario: escolheu ou propôs dia/horário (preencha horario_escolhido em ISO 8601 sem fuso, ex. 2026-09-30T14:00:00; se ele escolheu entre os horários oferecidos, use exatamente um deles)
- informou_email: passou o e-mail
- pede_ligacao: quer que liguem ou prefere ligação
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

REGRAS
- "dados" recebe SOMENTE o que o LEAD disse em qualquer mensagem do trecho abaixo. Nada inferido, nada que o agente tenha escrito, nada do nome de perfil do WhatsApp. Uma resposta curta ("sim", "não", "sou eu") vale para a pergunta que o agente acabou de fazer. Campo sem informação = null.
- Para o campo "negocio": preencha com o que o lead disse do negócio (nome, ramo, cidade) em uma frase curta. Preencha também segmento e cidade quando ele disse.
- Para os campos de sim ou não (perfil no Google, decisor, site, anúncio, indicação): responda "sim" ou "nao" e, se ele deu detalhe (link, print, nome da pessoa), acrescente depois de dois-pontos. Print ou link enviado como resposta a "tem perfil no Google?" vale "sim".
- nome_completo só quando o lead deu nome e sobrenome.
- tom_do_lead: curto_informal (poucas palavras, abreviações), informal, ou formal.
- confianca: baixa quando você não tem certeza do que o lead quis dizer.
- resposta_automatica: true se parece resposta automática de empresa (menu, horário de atendimento, "somos uma empresa que...").
- Se o agente ofereceu horários, os oferecidos foram: ${estado.dados._slots ? estado.dados._slots : 'nenhum'}.`
}

const fmtHist = (h: MsgHist[]) => h.map((m) => `${m.role === 'assistant' ? 'Agente' : 'Lead'}: ${m.content}`).join('\n')

export async function extrair(
  openai: OpenAI,
  p: { config: CompanyConfig; estado: Estado; historico: MsgHist[]; mensagemAtual: string },
  onUsage?: (c: OpenAI.Chat.ChatCompletion, agent: string) => void,
): Promise<Extracao> {
  const agoraSp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  const completion = await openai.chat.completions.create({
    model: MODELO_V3,
    temperature: 0,
    max_tokens: 700,
    response_format: { type: 'json_schema', json_schema: { name: 'extracao', strict: true, schema: schemaExtracao(p.config) as any } },
    messages: [
      { role: 'system', content: promptSistema(p.config, p.estado, agoraSp) },
      { role: 'user', content: `TRECHO DA CONVERSA:\n${fmtHist(p.historico)}\n\nMENSAGEM ATUAL DO LEAD (é a que você classifica):\n${p.mensagemAtual}` },
    ],
  })
  onUsage?.(completion, 'v3_extrator')
  const raw = JSON.parse(completion.choices[0]?.message?.content ?? '{}')
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
