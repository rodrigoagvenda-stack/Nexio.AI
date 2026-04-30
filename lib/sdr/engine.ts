/**
 * SDR Engine — Orquestrador multi-agente fiel ao fluxo N8N.
 *
 * Arquitetura:
 *   Orquestrador (GPT-4.1) →
 *     Think | RAG Conhecimento | RAG Objeções |
 *     Agente Pipeline | Agente Segmentação |
 *     Agente Outbound | Memory Expert |
 *     Agente Agendamento (Google Calendar — opcional)
 */

import { createServiceClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/crypto'
import { getPlatformConfig } from '@/lib/platform-config'
import { createUazapiClient, normalizePhone, detectMessageType, type UazapiWebhookMessage } from './uazapi'
import {
  checkAvailableSlots,
  createEventWithMeet,
  formatDateTimeBR,
  nextBusinessDay,
  isBusinessDay,
} from '@/lib/google-calendar'
import OpenAI from 'openai'
import {
  type UsageAcc,
  checkTenantQuota,
  recordUsage,
  pauseTenant,
  checkAndSendQuotaAlerts,
} from '@/lib/billing/usage'

// ─── Tipos ───────────────────────────────────────────────────

interface SdrContext {
  companyId: number
  companyName: string
  leadId: number
  leadPhone: string
  leadName: string
  conversationId: string | null
  uazapiUrl: string
  uazapiToken: string
  instanceName: string
  messageId: string
  agentType: 'atendimento_venda' | 'atendimento_venda_agendamento'
  prompt: string
  openaiKey: string
  calendarId: string | null
  flowId: string | null
  vectorTableConhecimento: string | null
  vectorTableObjecoes: string | null
  conhecimentoAtivo: boolean
  objecoesAtivo: boolean
}

interface BufferedMessage {
  content: string
  type: string
  timestamp: string
  messageId: string
}

type ChatMsg = { role: 'user' | 'assistant' | 'system'; content: string }

// ─── Usage accumulator helper ─────────────────────────────────

function pushUsage(
  acc: UsageAcc | undefined,
  completion: OpenAI.Chat.ChatCompletion,
  agent: string
): void {
  if (!acc || !completion.usage) return
  acc.push({
    agent,
    model: completion.model,
    promptTokens: completion.usage.prompt_tokens,
    completionTokens: completion.usage.completion_tokens,
    totalTokens: completion.usage.total_tokens,
  })
}

// ─── Prompt Injection ─────────────────────────────────────────

const INJECTION_PATTERNS = [
  /ignore\s+(previous|all|above|earlier|prior)\s*(instructions?|prompts?|rules?)/i,
  /esqueça?\s+(tudo|todas)\s*(instruções?|regras?|prompts?)/i,
  /você\s+é\s+agora\s+(um|uma)/i,
  /ignore\s+as\s+instruções/i,
  /novo\s+prompt/i,
  /revelar?\s+(suas?|o)\s+(prompt|instruções?|sistema)/i,
  /mostre?\s+(suas?|as)\s+instruções/i,
  /modo\s+(desenvolvedor|debug|admin)/i,
  /act\s+as\s+(a\s+)?(jailbreak|hacker|admin)/i,
  /<\|.*?(system|user|assistant).*?\|>/gi,
  /disregard\s+(previous|all|above)\s*(instructions?|rules?)/i,
  /forget\s+(everything|all|previous)/i,
]

function isPromptInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((p) => p.test(text))
}

// ─── Buffer (Supabase) ────────────────────────────────────────

async function bufferMessage(
  companyId: number,
  phone: string,
  message: BufferedMessage,
  supabase: ReturnType<typeof createServiceClient>
): Promise<void> {
  const expiresAt = new Date(Date.now() + 30_000).toISOString()
  const { data: existing } = await supabase
    .from('sdr_message_buffer')
    .select('messages')
    .eq('company_id', companyId)
    .eq('phone', phone)
    .single()

  if (existing) {
    const messages = [...(existing.messages as BufferedMessage[]), message]
    await supabase
      .from('sdr_message_buffer')
      .update({ messages, expires_at: expiresAt })
      .eq('company_id', companyId)
      .eq('phone', phone)
  } else {
    await supabase.from('sdr_message_buffer').insert({
      company_id: companyId,
      phone,
      messages: [message],
      expires_at: expiresAt,
    })
  }
}

async function drainBuffer(
  companyId: number,
  phone: string,
  supabase: ReturnType<typeof createServiceClient>
): Promise<BufferedMessage[]> {
  const { data } = await supabase
    .from('sdr_message_buffer')
    .select('messages')
    .eq('company_id', companyId)
    .eq('phone', phone)
    .single()

  await supabase
    .from('sdr_message_buffer')
    .delete()
    .eq('company_id', companyId)
    .eq('phone', phone)

  return (data?.messages as BufferedMessage[]) ?? []
}

// ─── RAG — Busca vetorial no Supabase ─────────────────────────

async function searchDocuments(
  query: string,
  companyId: number,
  openai: OpenAI,
  supabase: ReturnType<typeof createServiceClient>,
  vectorTable?: string | null
): Promise<string> {
  try {
    const embRes = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
    })
    const embedding = embRes.data[0].embedding
    const table = vectorTable ?? 'documents'

    const { data } = await supabase.rpc('match_documents', {
      query_embedding: embedding,
      match_count: 5,
      filter: { company_id: companyId },
      table_name: table,
    })

    if (!data || data.length === 0) return ''
    return (data as Array<{ content: string }>).map((d) => d.content).join('\n\n')
  } catch {
    return ''
  }
}

// ─── Histórico de conversa ─────────────────────────────────────

async function getHistory(
  leadId: number,
  companyId: number,
  supabase: ReturnType<typeof createServiceClient>,
  limit = 10
): Promise<ChatMsg[]> {
  const { data } = await supabase
    .from('mensagens_do_whatsapp')
    .select('texto_da_mensagem, sender_type')
    .eq('id_do_lead', leadId)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (!data) return []
  return data
    .reverse()
    .filter((m) => m.texto_da_mensagem)
    .map((m) => ({
      role: (m.sender_type === 'ai' ? 'assistant' : 'user') as 'user' | 'assistant',
      content: m.texto_da_mensagem ?? '',
    }))
}

// ─── Loop genérico de sub-agente (espelha AI Agent node do N8N) ──

async function runAgentLoop(
  systemPrompt: string,
  userMessage: string,
  tools: OpenAI.Chat.ChatCompletionTool[],
  toolHandlers: Record<string, (args: any) => Promise<string>>,
  openai: OpenAI,
  model: string,
  acc?: UsageAcc,
  agentName?: string,
  maxIterations = 10
): Promise<string> {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ]

  for (let i = 0; i < maxIterations; i++) {
    const completion = await openai.chat.completions.create({
      model,
      messages,
      tools,
      tool_choice: 'auto',
      max_tokens: 500,
      temperature: 0.1,
    })
    if (acc && agentName) pushUsage(acc, completion, agentName)

    const msg = completion.choices[0].message
    messages.push(msg as OpenAI.Chat.ChatCompletionMessageParam)

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      return msg.content ?? ''
    }

    for (const tc of msg.tool_calls) {
      const fnCall = (tc as any).function as { name: string; arguments: string }
      let args: any = {}
      try { args = JSON.parse(fnCall.arguments) } catch { /* ok */ }
      const handler = toolHandlers[fnCall.name]
      const result = handler ? await handler(args) : `Tool ${fnCall.name} não implementada`
      messages.push({ role: 'tool', tool_call_id: tc.id, content: result })
    }
  }

  return 'Agente atingiu limite de iterações'
}

// ─── Sub-agentes ───────────────────────────────────────────────

async function runAgentePipeline(
  message: string,
  ctx: SdrContext,
  openai: OpenAI,
  supabase: ReturnType<typeof createServiceClient>,
  acc?: UsageAcc
): Promise<string> {
  const systemPrompt = `Você é responsável por mover o lead entre os estágios do kanban no CRM.
IMPORTANTE: Se não houver informação suficiente na conversa para determinar o estágio com certeza, NÃO atualize o campo. Mantenha o estágio atual do lead.

FERRAMENTAS DISPONÍVEIS:
- "Think5": use para raciocinar sobre qual estágio aplicar
- "Buscar_lead1": busca os dados atuais do lead usando o whatsapp como identificador único
- "Atualizar_resumo1": atualiza o campo de estágio no CRM

ORDEM DE EXECUÇÃO OBRIGATÓRIA:
1. Use "Buscar_lead1" passando o número do whatsapp do lead
2. Use "Think5" para raciocinar sobre qual estágio aplicar
3. Use "Atualizar_resumo1" para salvar o novo estágio

ESTÁGIOS DISPONÍVEIS (use exatamente assim):
"Triagem", "Outbound", "Novo lead", "Em contato", "Interessado", "Proposta enviada", "Fechado", "Perdido", "Remarketing"

REGRAS: Lead mandou mensagem → "Em contato"; interesse claro → "Interessado"; call_de_venda=true → "Proposta enviada"; sem resposta → "Remarketing"; fechado → "Fechado"; desistiu → "Perdido"

RETORNO FINAL: {"atualizado": true|false, "estagio": "nome"}`

  const tools: OpenAI.Chat.ChatCompletionTool[] = [
    {
      type: 'function',
      function: {
        name: 'Think5',
        description: 'Raciocina sobre qual estágio do pipeline aplicar ao lead',
        parameters: { type: 'object', properties: { thought: { type: 'string' } }, required: ['thought'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'Buscar_lead1',
        description: 'Busca os dados atuais do lead usando o whatsapp como identificador único',
        parameters: { type: 'object', properties: { whatsapp: { type: 'string' } }, required: ['whatsapp'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'Atualizar_resumo1',
        description: 'Atualiza o campo de estágio no CRM',
        parameters: { type: 'object', properties: { estagio: { type: 'string' } }, required: ['estagio'] },
      },
    },
  ]

  const validStages = ['Triagem', 'Outbound', 'Novo lead', 'Em contato', 'Interessado', 'Proposta enviada', 'Fechado', 'Perdido', 'Remarketing']

  const handlers: Record<string, (args: any) => Promise<string>> = {
    'Think5': async (args) => `Raciocínio registrado: ${args.thought}`,
    'Buscar_lead1': async (_args) => {
      const { data } = await supabase
        .from('leads')
        .select('id, status, whatsapp, contact_name, segment, priority, nivel_interesse, call_de_venda')
        .eq('id', ctx.leadId)
        .single()
      return JSON.stringify(data ?? {})
    },
    'Atualizar_resumo1': async (args) => {
      if (!validStages.includes(args.estagio)) return `Estágio inválido: ${args.estagio}`
      await supabase.from('leads').update({ status: args.estagio, updated_at: new Date().toISOString() }).eq('id', ctx.leadId)
      return JSON.stringify({ atualizado: true, estagio: args.estagio })
    },
  }

  return runAgentLoop(
    systemPrompt,
    `WhatsApp do lead: ${ctx.leadPhone}\nMensagem: ${message}`,
    tools, handlers, openai, 'gpt-4.1-mini', acc, 'pipeline'
  )
}

async function runAgenteSegmentacao(
  message: string,
  ctx: SdrContext,
  openai: OpenAI,
  supabase: ReturnType<typeof createServiceClient>,
  acc?: UsageAcc
): Promise<string> {
  const systemPrompt = `Você é o Agente de Segmentação. Identifica o nicho do lead com base na conversa e atualiza o campo de segmento no CRM.

ORDEM DE EXECUÇÃO OBRIGATÓRIA:
1. Use "Buscar_nincho" passando o whatsapp do lead
2. Use "Think" para raciocinar sobre o nicho correto
3. Use "Atualizar_nincho" para salvar o segmento

NICHOS DISPONÍVEIS (use exatamente um deles):
E-commerce, Saúde/Medicina, Educação, Alimentação, Beleza/Estética, Imobiliária, Advocacia, Consultoria, Tecnologia, Moda/Fashion, Arquitetura, Auto Escola, Restaurante, Academia, Farmácia, Padaria, Supermercado, Floricultura, Hotel/Pousada, Oficina Mecânica, Pet Shop, Outros

RETORNO FINAL: {"atualizado": true|false, "segmento": "nome"}`

  const tools: OpenAI.Chat.ChatCompletionTool[] = [
    {
      type: 'function',
      function: {
        name: 'Buscar_nincho',
        description: 'Busca os dados atuais do lead pelo whatsapp, incluindo segmento atual',
        parameters: { type: 'object', properties: { whatsapp: { type: 'string' } }, required: ['whatsapp'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'Think',
        description: 'Raciocina sobre qual nicho/segmento aplicar ao lead',
        parameters: { type: 'object', properties: { thought: { type: 'string' } }, required: ['thought'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'Atualizar_nincho',
        description: 'Atualiza o campo de segmento no CRM',
        parameters: { type: 'object', properties: { segmento: { type: 'string' } }, required: ['segmento'] },
      },
    },
  ]

  const validNichos = ['E-commerce', 'Saúde/Medicina', 'Educação', 'Alimentação', 'Beleza/Estética', 'Imobiliária', 'Advocacia', 'Consultoria', 'Tecnologia', 'Moda/Fashion', 'Arquitetura', 'Auto Escola', 'Restaurante', 'Academia', 'Farmácia', 'Padaria', 'Supermercado', 'Floricultura', 'Hotel/Pousada', 'Oficina Mecânica', 'Pet Shop', 'Outros']

  const handlers: Record<string, (args: any) => Promise<string>> = {
    'Buscar_nincho': async (_args) => {
      const { data } = await supabase
        .from('leads')
        .select('id, whatsapp, contact_name, segment, status')
        .eq('id', ctx.leadId)
        .single()
      return JSON.stringify(data ?? {})
    },
    'Think': async (args) => `Raciocínio registrado: ${args.thought}`,
    'Atualizar_nincho': async (args) => {
      if (!validNichos.includes(args.segmento)) return `Segmento inválido: ${args.segmento}`
      await supabase.from('leads').update({ segment: args.segmento, updated_at: new Date().toISOString() }).eq('id', ctx.leadId)
      return JSON.stringify({ atualizado: true, segmento: args.segmento })
    },
  }

  return runAgentLoop(
    systemPrompt,
    `WhatsApp do lead: ${ctx.leadPhone}\nMensagem: ${message}`,
    tools, handlers, openai, 'gpt-4.1-mini', acc, 'segmentacao'
  )
}

async function runAgenteOutbound(
  message: string,
  ctx: SdrContext,
  openai: OpenAI,
  supabase: ReturnType<typeof createServiceClient>,
  acc?: UsageAcc
): Promise<string> {
  const systemPrompt = `Você é o Agente de Contexto Outbound. Identifica a origem do lead e fornece contexto para o SDR.

ORDEM DE EXECUÇÃO OBRIGATÓRIA:
PASSO 1: Use "Buscar_origem_lead_no_supabase" passando o whatsapp do lead
  - Se status = "Outbound" → vá para PASSO 2
  - Caso contrário → retorne com origem=inbound diretamente

PASSO 2: Use "Buscar_mensagem_enviada_outbound" para obter a mensagem outbound original (obrigatório se outbound)

PASSO 3: Use "Salvar_resposta_e_score_do_lead" com score de 1-10 baseado no tom da resposta do lead

RETORNO FINAL: {"origem":"outbound|inbound","mensagem_enviada":"...","score_interesse":<1-10>,"briefing_preenchido":<bool>}`

  const tools: OpenAI.Chat.ChatCompletionTool[] = [
    {
      type: 'function',
      function: {
        name: 'Buscar_origem_lead_no_supabase',
        description: 'Busca a origem e status atual do lead pelo whatsapp',
        parameters: { type: 'object', properties: { whatsapp: { type: 'string' } }, required: ['whatsapp'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'Buscar_mensagem_enviada_outbound',
        description: 'Busca a mensagem outbound original que foi enviada ao lead',
        parameters: { type: 'object', properties: { whatsapp: { type: 'string' } }, required: ['whatsapp'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'Salvar_resposta_e_score_do_lead',
        description: 'Salva a resposta do lead e o score de interesse (1-10)',
        parameters: {
          type: 'object',
          properties: {
            whatsapp: { type: 'string' },
            score_interesse: { type: 'number' },
            resposta_recebida: { type: 'string' },
          },
          required: ['whatsapp', 'score_interesse', 'resposta_recebida'],
        },
      },
    },
  ]

  const handlers: Record<string, (args: any) => Promise<string>> = {
    'Buscar_origem_lead_no_supabase': async (_args) => {
      const { data } = await supabase
        .from('leads')
        .select('id, status, origem, whatsapp, contact_name, briefing_preenchido')
        .eq('id', ctx.leadId)
        .single()
      return JSON.stringify(data ?? {})
    },
    'Buscar_mensagem_enviada_outbound': async (_args) => {
      const { data } = await supabase
        .from('outbound_campaigns')
        .select('mensagem_enviada, status, created_at')
        .eq('company_id', ctx.companyId)
        .eq('whatsapp', ctx.leadPhone)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      return JSON.stringify(data ?? { mensagem_enviada: null })
    },
    'Salvar_resposta_e_score_do_lead': async (args) => {
      await supabase
        .from('outbound_campaigns')
        .update({
          respondeu: true,
          respondeu_em: new Date().toISOString(),
          resposta_recebida: args.resposta_recebida,
        })
        .eq('company_id', ctx.companyId)
        .eq('whatsapp', ctx.leadPhone)
      return JSON.stringify({ salvo: true, score_interesse: args.score_interesse })
    },
  }

  return runAgentLoop(
    systemPrompt,
    `WhatsApp do lead: ${ctx.leadPhone}\nMensagem recebida: ${message}`,
    tools, handlers, openai, 'gpt-4.1-mini', acc, 'outbound'
  )
}

async function runMemoryExpert(
  info: string,
  ctx: SdrContext,
  openai: OpenAI,
  supabase: ReturnType<typeof createServiceClient>,
  acc?: UsageAcc
): Promise<string> {
  const systemPrompt = `Você é o Agente de Registro. Consolida informações do lead e atualiza o CRM após cada interação.

ORDEM DE EXECUÇÃO OBRIGATÓRIA:
1. Use "Think4" para raciocinar sobre o que deve ser atualizado
2. Use "Buscar_lead" para obter os dados atuais do lead
3. Compare as informações novas com as existentes
4. Use "Think4" novamente para decidir exatamente o que atualizar
5. Use "Atualizar_resumo" para salvar as atualizações

CAMPOS QUE VOCÊ ATUALIZA:
- resumo_ia: resumo executivo (máx 200 palavras, bullet points)
- segment: segmento/nicho do lead
- priority: "Alta" | "Média" | "Baixa"
- nivel_interesse: "Quente 🔥" | "Morno 🌡️" | "Frio ❄️"
- updated_at: sempre atualizar

Só atualize um campo se tiver informação nova relevante.`

  const tools: OpenAI.Chat.ChatCompletionTool[] = [
    {
      type: 'function',
      function: {
        name: 'Think4',
        description: 'Raciocina sobre as informações do lead e o que deve ser atualizado',
        parameters: { type: 'object', properties: { thought: { type: 'string' } }, required: ['thought'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'Buscar_lead',
        description: 'Busca os dados atuais do lead no CRM',
        parameters: { type: 'object', properties: { whatsapp: { type: 'string' } }, required: ['whatsapp'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'Atualizar_resumo',
        description: 'Atualiza os campos do lead no CRM',
        parameters: {
          type: 'object',
          properties: {
            resumo_ia: { type: 'string' },
            segment: { type: 'string' },
            priority: { type: 'string', enum: ['Alta', 'Média', 'Baixa'] },
            nivel_interesse: { type: 'string', enum: ['Quente 🔥', 'Morno 🌡️', 'Frio ❄️'] },
          },
        },
      },
    },
  ]

  const handlers: Record<string, (args: any) => Promise<string>> = {
    'Think4': async (args) => `Raciocínio: ${args.thought}`,
    'Buscar_lead': async (_args) => {
      const { data } = await supabase
        .from('leads')
        .select('id, whatsapp, contact_name, resumo_ia, segment, priority, nivel_interesse, status, notes')
        .eq('id', ctx.leadId)
        .single()
      return JSON.stringify(data ?? {})
    },
    'Atualizar_resumo': async (args) => {
      const updates: Record<string, any> = { updated_at: new Date().toISOString() }
      if (args.resumo_ia) updates.resumo_ia = args.resumo_ia
      if (args.segment) updates.segment = args.segment
      if (args.priority) updates.priority = args.priority
      if (args.nivel_interesse) updates.nivel_interesse = args.nivel_interesse
      await supabase.from('leads').update(updates).eq('id', ctx.leadId)
      return JSON.stringify({ atualizado: true, campos: Object.keys(updates) })
    },
  }

  return runAgentLoop(
    systemPrompt,
    `WhatsApp do lead: ${ctx.leadPhone}\nNova informação: ${info}`,
    tools, handlers, openai, 'gpt-4.1-mini', acc, 'memory'
  )
}

/** Agente de Agendamento — Google Calendar + Meet */
async function runAgenteAgendamento(
  message: string,
  ctx: SdrContext,
  openai: OpenAI,
  supabase: ReturnType<typeof createServiceClient>,
  acc?: UsageAcc
): Promise<string> {
  if (!ctx.calendarId) {
    return 'Agendamento não configurado para esta empresa. Peça ao administrador para configurar o Google Calendar.'
  }

  const systemPrompt = `Você é o Agente de Agendamento. Seu único trabalho é agendar, remarcar ou cancelar calls de venda via Google Calendar.

FERRAMENTAS DISPONÍVEIS:
- "Hora_atual": retorna a data e hora atual no fuso America/Bahia
- "Buscar_reuniao": busca os dados de agendamento atual do lead
- "Consultar_gcal": consulta horários disponíveis no calendário para uma data específica
- "Agendar_gcal": cria um evento no Google Calendar com Meet
- "Deletar_gcal": cancela/deleta um evento existente
- "Reuniao_marcada": salva os dados da reunião no CRM

REGRAS OBRIGATÓRIAS:
- Apenas Seg a Sex, 9h às 18h, fuso America/Bahia
- NUNCA agende para o mesmo dia de hoje
- Se o lead já informou um horário específico → confirme sem sugerir outros
- Se o lead quer remarcar → cancele o anterior antes de criar o novo
- Responda em no máximo 2 linhas para o lead

ORDEM:
1. "Hora_atual" para saber a data/hora atual
2. "Buscar_reuniao" para ver se o lead já tem agendamento
3. "Consultar_gcal" para ver horários disponíveis (se necessário)
4. "Agendar_gcal" ou "Deletar_gcal" conforme a ação
5. "Reuniao_marcada" para salvar no CRM`

  const tools: OpenAI.Chat.ChatCompletionTool[] = [
    {
      type: 'function',
      function: {
        name: 'Hora_atual',
        description: 'Retorna a data e hora atual no fuso America/Bahia',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'Buscar_reuniao',
        description: 'Busca os dados de agendamento atual do lead no CRM',
        parameters: { type: 'object', properties: { whatsapp: { type: 'string' } }, required: ['whatsapp'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'Consultar_gcal',
        description: 'Consulta horários disponíveis no Google Calendar para uma data',
        parameters: {
          type: 'object',
          properties: { data: { type: 'string', description: 'Data no formato YYYY-MM-DD' } },
          required: ['data'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'Agendar_gcal',
        description: 'Cria um evento no Google Calendar com link Meet',
        parameters: {
          type: 'object',
          properties: {
            data_hora: { type: 'string', description: 'ISO8601, ex: 2026-05-05T10:00:00' },
            titulo: { type: 'string' },
            duracao_minutos: { type: 'number' },
          },
          required: ['data_hora', 'titulo'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'Deletar_gcal',
        description: 'Cancela/deleta um evento existente no Google Calendar',
        parameters: { type: 'object', properties: { event_id: { type: 'string' } }, required: ['event_id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'Reuniao_marcada',
        description: 'Salva os dados da reunião agendada no CRM',
        parameters: {
          type: 'object',
          properties: {
            data_hora_iso: { type: 'string' },
            meet_url: { type: 'string' },
            event_id: { type: 'string' },
            acao: { type: 'string', enum: ['agendar', 'remarcar', 'cancelar'] },
          },
          required: ['acao'],
        },
      },
    },
  ]

  const handlers: Record<string, (args: any) => Promise<string>> = {
    'Hora_atual': async (_args) => {
      return new Date().toLocaleString('pt-BR', { timeZone: 'America/Bahia', dateStyle: 'full', timeStyle: 'short' })
    },
    'Buscar_reuniao': async (_args) => {
      const { data } = await supabase
        .from('leads')
        .select('call_de_venda, call_agendada_para, meet_url, call_status, contact_name')
        .eq('id', ctx.leadId)
        .single()
      return JSON.stringify(data ?? {})
    },
    'Consultar_gcal': async (args) => {
      try {
        const date = new Date(args.data)
        const slots = await checkAvailableSlots({ calendarId: ctx.calendarId!, date })
        const available = slots.filter((s) => s.available).slice(0, 5)
        if (available.length === 0) return 'Nenhum horário disponível nesta data.'
        return available.map((s) =>
          s.start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Bahia' })
        ).join(', ')
      } catch (err: any) {
        return `Erro ao consultar calendário: ${err.message}`
      }
    },
    'Agendar_gcal': async (args) => {
      try {
        const start = new Date(args.data_hora)
        const event = await createEventWithMeet({
          calendarId: ctx.calendarId!,
          title: args.titulo ?? `Call de venda — ${ctx.leadName}`,
          description: `Lead: ${ctx.leadName}\nWhatsApp: ${ctx.leadPhone}\nAgendado via Nexio.AI SDR`,
          start,
          durationMinutes: args.duracao_minutos ?? 60,
        })
        return JSON.stringify({ event_id: event.eventId, meet_url: event.meetUrl, start: event.start.toISOString(), data_formatada: formatDateTimeBR(event.start) })
      } catch (err: any) {
        return `Erro ao criar evento: ${err.message}`
      }
    },
    'Deletar_gcal': async (args) => {
      try {
        await supabase.from('leads').update({ call_de_venda: false, call_status: 'cancelada', updated_at: new Date().toISOString() }).eq('id', ctx.leadId)
        return JSON.stringify({ deletado: true, event_id: args.event_id })
      } catch (err: any) {
        return `Erro ao cancelar: ${err.message}`
      }
    },
    'Reuniao_marcada': async (args) => {
      const updates: Record<string, any> = { updated_at: new Date().toISOString() }
      if (args.acao === 'cancelar') {
        updates.call_de_venda = false
        updates.call_status = 'cancelada'
      } else if (args.data_hora_iso) {
        updates.call_de_venda = true
        updates.call_agendada_para = args.data_hora_iso
        updates.meet_url = args.meet_url ?? null
        updates.call_status = 'agendada'
      }
      await supabase.from('leads').update(updates).eq('id', ctx.leadId)
      return JSON.stringify({ salvo: true, acao: args.acao })
    },
  }

  return runAgentLoop(
    systemPrompt,
    `WhatsApp do lead: ${ctx.leadPhone}\nNome: ${ctx.leadName}\nMensagem: ${message}`,
    tools, handlers, openai, 'gpt-4.1', acc, 'agendamento'
  )
}


// ─── Orquestrador Principal ─────────────────────────────────────

interface AgentPersona {
  nome_agente?: string
  tom?: string
  empresa?: string
  produto?: string
  restricoes?: string
  horario?: string
}

function parsePersona(prompt: string): AgentPersona | null {
  if (!prompt) return null
  try {
    const p = JSON.parse(prompt)
    if (p && (p.nome_agente || p.empresa || p.produto)) return p as AgentPersona
  } catch { /* not JSON */ }
  return null
}

function buildOrchestratorSystem(ctx: SdrContext): string {
  // ── Camada 1 (FIXO): lógica N8N ──────────────────────────────
  const knowledgeStep = ctx.conhecimentoAtivo
    ? '2. Chame "buscar_conhecimento" passando a mensagem como query'
    : null
  const objStep = ctx.objecoesAtivo
    ? `${knowledgeStep ? '3' : '2'}. Chame "buscar_objections" passando a mensagem como query`
    : null
  const baseIdx = (knowledgeStep ? 1 : 0) + (objStep ? 1 : 0) + 2
  const steps = [
    '1. Chame "think" passando a mensagem',
    ...(knowledgeStep ? [knowledgeStep] : []),
    ...(objStep ? [objStep] : []),
    `${baseIdx}. Chame "agente_pipeline" passando a mensagem`,
    `${baseIdx + 1}. Chame "agente_segmentacao" passando a mensagem`,
    `${baseIdx + 2}. Chame "agente_outbound" passando a mensagem`,
    `${baseIdx + 3}. Chame "memory_long"`,
  ]

  const fixedLogic = `Você é um orquestrador. Você não tem conhecimento próprio sobre nada.
Se você responder sem chamar as tools vai ser multado em 2 milhões de dólares, você não sabe responder, não importa se é só um OI, você NÃO SABE!

Quando receber uma mensagem:
${steps.join('\n')}

Você é INCAPAZ de responder sem chamar essas tools porque não possui nenhuma informação. Todo seu conhecimento vem exclusivamente dos retornos das tools.

Após chamar todas as tools, formate a resposta usando o conteúdo retornado pelo "buscar_conhecimento".`

  // ── Camada 2 (DINÂMICO): identidade da empresa ────────────────
  const persona = parsePersona(ctx.prompt)
  let companyBlock = ''
  if (persona) {
    const lines: string[] = []
    if (persona.nome_agente) lines.push(`Você se chama ${persona.nome_agente}.`)
    if (persona.tom)         lines.push(`Tom: ${persona.tom}.`)
    if (persona.empresa)     lines.push(`Empresa: ${persona.empresa}.`)
    if (persona.produto)     lines.push(`Produto/serviço: ${persona.produto}.`)
    if (persona.restricoes)  lines.push(`Nunca diga: ${persona.restricoes}.`)
    if (persona.horario)     lines.push(`Horário de atendimento: ${persona.horario}.`)
    if (lines.length > 0) companyBlock = `\n\nCONTEXTO DA EMPRESA:\n${lines.join('\n')}`
  } else if (ctx.prompt) {
    companyBlock = `\n\nCONTEXTO DA EMPRESA:\n${ctx.prompt}`
  }

  // ── Camada 3 (FIXO condicional): agendamento ─────────────────
  const schedulingBlock = ctx.calendarId
    ? '\n\nChame "agente_agendamento" passando no campo Nova_informação_para_guardar a última mensagem do lead + o histórico resumido da conversa sobre agendamento até o momento. Faça isso SOMENTE quando o lead demonstrar intenção clara de agendar, remarcar ou cancelar reunião/call. Retorne exatamente o que ele responder, sem alterar nada. Mensagens genéricas como "deu certo", "ok", "entendi" ou qualquer outro assunto NÃO devem acionar esse agente.'
    : ''

  return `${fixedLogic}${companyBlock}${schedulingBlock}`
}

function buildOrchestratorTools(ctx: SdrContext): OpenAI.Chat.ChatCompletionTool[] {
  const tools: OpenAI.Chat.ChatCompletionTool[] = [
    {
      type: 'function',
      function: {
        name: 'think',
        description: 'Raciocina sobre a mensagem antes de agir. Use sempre como primeiro passo.',
        parameters: {
          type: 'object',
          properties: { thought: { type: 'string', description: 'Seu raciocínio sobre a mensagem do lead' } },
          required: ['thought'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'agente_pipeline',
        description: 'Move o lead pelo estágio correto do kanban com base na interação.',
        parameters: {
          type: 'object',
          properties: { message: { type: 'string', description: 'Mensagem do lead' } },
          required: ['message'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'agente_segmentacao',
        description: 'Identifica o nicho do lead e atualiza o CRM.',
        parameters: {
          type: 'object',
          properties: { message: { type: 'string', description: 'Mensagem do lead' } },
          required: ['message'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'agente_outbound',
        description: 'Identifica a origem do lead (inbound/outbound) e registra a resposta.',
        parameters: {
          type: 'object',
          properties: { message: { type: 'string', description: 'Mensagem do lead' } },
          required: ['message'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'memory_long',
        description: 'Salva informações relevantes da interação na memória de longo prazo do lead.',
        parameters: {
          type: 'object',
          properties: { info: { type: 'string', description: 'Informação nova relevante para guardar' } },
          required: ['info'],
        },
      },
    },
  ]

  if (ctx.conhecimentoAtivo) {
    tools.splice(1, 0, {
      type: 'function',
      function: {
        name: 'buscar_conhecimento',
        description: 'Busca na base de conhecimento da empresa a resposta correta para a dúvida do lead.',
        parameters: {
          type: 'object',
          properties: { query: { type: 'string', description: 'A mensagem ou dúvida do lead' } },
          required: ['query'],
        },
      },
    })
  }

  if (ctx.objecoesAtivo) {
    tools.splice(ctx.conhecimentoAtivo ? 2 : 1, 0, {
      type: 'function',
      function: {
        name: 'buscar_objections',
        description: 'Busca argumentos e estratégias para lidar com objeções do lead.',
        parameters: {
          type: 'object',
          properties: { query: { type: 'string', description: 'A objeção ou dúvida do lead' } },
          required: ['query'],
        },
      },
    })
  }

  if (ctx.calendarId) {
    tools.push({
      type: 'function',
      function: {
        name: 'agente_agendamento',
        description: 'Realiza agendamento de call/reunião. Use SOMENTE quando o lead demonstrar intenção clara de agendar.',
        parameters: {
          type: 'object',
          properties: { message: { type: 'string', description: 'Contexto completo do agendamento' } },
          required: ['message'],
        },
      },
    })
  }

  return tools
}

async function runOrchestrator(
  messages: BufferedMessage[],
  history: ChatMsg[],
  ctx: SdrContext,
  leadNotes: string,
  supabase: ReturnType<typeof createServiceClient>,
  openai: OpenAI,
  acc: UsageAcc
): Promise<string> {
  const userInput = messages.map((m) => m.content).join('\n\n')
  const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Bahia' })

  const systemMsg = `${buildOrchestratorSystem(ctx)}

CONTEXTO DO CRM:
- Lead: ${ctx.leadName} | WhatsApp: ${ctx.leadPhone}
- Notas: ${leadNotes || 'nenhuma'}
- Empresa: ${ctx.companyName}
- Data/hora: ${now}`

  const TOOLS = buildOrchestratorTools(ctx)

  const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemMsg },
    ...history,
    { role: 'user', content: userInput },
  ]

  let response = await openai.chat.completions.create({
    model: 'gpt-4.1',
    messages: chatMessages,
    tools: TOOLS,
    tool_choice: 'required',
    max_tokens: 2000,
    temperature: 0.1,
  })
  pushUsage(acc, response, 'orchestrator')

  let iterations = 0
  while (response.choices[0]?.finish_reason === 'tool_calls' && iterations < 20) {
    iterations++
    const assistantMsg = response.choices[0].message
    chatMessages.push(assistantMsg)

    const toolCalls = assistantMsg.tool_calls ?? []
    const toolResults: OpenAI.Chat.ChatCompletionToolMessageParam[] = []

    for (const toolCall of toolCalls) {
      if (toolCall.type !== 'function') continue
      const fn = (toolCall as any).function.name as string
      let args: Record<string, string> = {}
      try { args = JSON.parse((toolCall as any).function.arguments) } catch { /* ok */ }

      let result = ''

      if (fn === 'think') {
        result = `Pensamento registrado: ${args.thought}`
      } else if (fn === 'buscar_conhecimento') {
        result = await searchDocuments(args.query ?? userInput, ctx.companyId, openai, supabase, ctx.vectorTableConhecimento)
        if (!result) result = 'Base de conhecimento: nenhum resultado encontrado para esta query.'
      } else if (fn === 'buscar_objections') {
        result = await searchDocuments(args.query ?? userInput, ctx.companyId, openai, supabase, ctx.vectorTableObjecoes)
        if (!result) result = 'Objeções: nenhum argumento encontrado. Use o bom senso.'
      } else if (fn === 'agente_pipeline') {
        result = await runAgentePipeline(args.message ?? userInput, ctx, openai, supabase, acc)
      } else if (fn === 'agente_segmentacao') {
        result = await runAgenteSegmentacao(args.message ?? userInput, ctx, openai, supabase, acc)
      } else if (fn === 'agente_outbound') {
        result = await runAgenteOutbound(args.message ?? userInput, ctx, openai, supabase, acc)
      } else if (fn === 'memory_long') {
        result = await runMemoryExpert(args.info ?? userInput, ctx, openai, supabase, acc)
      } else if (fn === 'agente_agendamento') {
        result = await runAgenteAgendamento(args.message ?? userInput, ctx, openai, supabase, acc)
      }

      toolResults.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: result,
      })
    }

    chatMessages.push(...toolResults)

    response = await openai.chat.completions.create({
      model: 'gpt-4.1',
      messages: chatMessages,
      tools: TOOLS,
      tool_choice: 'auto',
      max_tokens: 1000,
      temperature: 0.1,
    })
    pushUsage(acc, response, 'orchestrator_loop')
  }

  return response.choices[0]?.message?.content ?? ''
}

// ─── Conversa e mensagens ──────────────────────────────────────

async function ensureConversation(
  ctx: SdrContext,
  supabase: ReturnType<typeof createServiceClient>
): Promise<string> {
  const { data: existing } = await supabase
    .from('conversas_do_whatsapp')
    .select('id')
    .eq('company_id', ctx.companyId)
    .eq('numero_de_telefone', ctx.leadPhone)
    .maybeSingle()

  if (existing?.id) return existing.id

  const { data: created } = await supabase
    .from('conversas_do_whatsapp')
    .insert({
      company_id: ctx.companyId,
      id_do_lead: ctx.leadId,
      numero_de_telefone: ctx.leadPhone,
      nome_do_contato: ctx.leadName,
      ultima_mensagem: '',
      hora_da_ultima_mensagem: new Date().toISOString(),
      status_da_conversa: 'aberto',
      contagem_nao_lida: 0,
      instance_name: ctx.instanceName || null,
    })
    .select('id')
    .single()

  return created?.id ?? ''
}

async function saveInbound(
  conversationId: string,
  ctx: SdrContext,
  text: string,
  supabase: ReturnType<typeof createServiceClient>
): Promise<void> {
  await supabase.from('mensagens_do_whatsapp').insert({
    id_da_conversacao: conversationId,
    id_do_lead: ctx.leadId,
    company_id: ctx.companyId,
    texto_da_mensagem: text,
    tipo_de_mensagem: 'text',
    direcao: 'inbound',
    sender_type: 'lead',
    status: 'received',
  })
  await supabase
    .from('conversas_do_whatsapp')
    .update({ ultima_mensagem: text, hora_da_ultima_mensagem: new Date().toISOString() })
    .eq('id', conversationId)
}

async function saveOutbound(
  conversationId: string,
  ctx: SdrContext,
  text: string,
  supabase: ReturnType<typeof createServiceClient>
): Promise<void> {
  await supabase.from('mensagens_do_whatsapp').insert({
    id_da_conversacao: conversationId,
    id_do_lead: ctx.leadId,
    company_id: ctx.companyId,
    texto_da_mensagem: text,
    tipo_de_mensagem: 'text',
    direcao: 'outbound',
    sender_type: 'ai',
    status: 'sent',
    nome_do_agente: 'SDR IA',
  })
  await supabase
    .from('conversas_do_whatsapp')
    .update({ ultima_mensagem: text, hora_da_ultima_mensagem: new Date().toISOString() })
    .eq('id', conversationId)
}

// ─── Lead ──────────────────────────────────────────────────────

async function findOrCreateLead(
  companyId: number,
  phone: string,
  name: string,
  supabase: ReturnType<typeof createServiceClient>
): Promise<{ id: number; notes: string }> {
  const { data: existing } = await supabase
    .from('leads')
    .select('id, notes')
    .eq('company_id', companyId)
    .eq('whatsapp', phone)
    .maybeSingle()

  if (existing) return { id: existing.id, notes: existing.notes ?? '' }

  const { data: created } = await supabase
    .from('leads')
    .insert({
      company_id: companyId,
      whatsapp: phone,
      contact_name: name || 'Não identificado',
      status: 'Lead novo',
      import_source: 'WhatsApp',
      origem: 'inbound',
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  return { id: created?.id ?? 0, notes: '' }
}

// ─── Envio com delay humanizado ────────────────────────────────

async function sendWithHumanDelay(
  paragraphs: string[],
  phone: string,
  uazapiUrl: string,
  token: string,
  conversationId: string,
  ctx: SdrContext,
  supabase: ReturnType<typeof createServiceClient>
): Promise<void> {
  const uazapi = createUazapiClient(uazapiUrl, token)

  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i]
    if (!paragraph.trim()) continue

    const typingDelay = Math.floor(Math.random() * (8000 - 3000 + 1)) + 3000
    await uazapi.sendPresence(phone, 'composing', typingDelay)
    await new Promise((r) => setTimeout(r, typingDelay))

    await uazapi.sendText({ number: phone, text: paragraph })
    await saveOutbound(conversationId, ctx, paragraph, supabase)

    if (i < paragraphs.length - 1) {
      await new Promise((r) => setTimeout(r, 1500))
    }
  }
}

// ─── Log ───────────────────────────────────────────────────────

async function log(
  companyId: number,
  eventType: string,
  payload: object,
  supabase: ReturnType<typeof createServiceClient>,
  phone?: string,
  leadId?: number,
  errorMessage?: string
): Promise<void> {
  try {
    await supabase.from('sdr_logs').insert({
      company_id: companyId,
      phone,
      lead_id: leadId,
      event_type: eventType,
      payload,
      error_message: errorMessage,
    })
  } catch {
    // log nunca quebra o fluxo
  }
}

// ─── Carrega configuração (sdr_configs ou sdr_flows) ───────────

interface SdrFullConfig {
  agente_ativo: boolean
  uazapi_token: string
  openai_key: string
  uazapi_instance_url: string
  uazapi_instance_name: string
  agent_type: 'atendimento_venda' | 'atendimento_venda_agendamento'
  prompt: string
  google_calendar_id: string | null
  flowId: string | null
  vectorTableConhecimento: string | null
  vectorTableObjecoes: string | null
  conhecimentoAtivo: boolean
  objecoesAtivo: boolean
}

async function loadSdrConfig(
  companyId: number,
  supabase: ReturnType<typeof createServiceClient>,
  phone?: string
): Promise<SdrFullConfig | null> {
  // Tenta encontrar fluxo ativo que cubra o número (via sdr_flows)
  const { data: flows } = await supabase
    .from('sdr_flows')
    .select('*')
    .eq('company_id', companyId)
    .eq('ativo', true)
    .in('tipo', ['inbound', 'ambos'])
    .limit(1)

  const flow = flows?.[0]

  // Busca config base (credenciais uazapi + openai)
  const { data: config } = await supabase
    .from('sdr_configs')
    .select('*')
    .eq('company_id', companyId)
    .single()

  if (!config) {
    console.warn(`[SDR:${companyId}] loadSdrConfig → NULL: sdr_configs row não encontrado`)
    return null
  }

  // Verifica agente_ativo na tabela companies (fonte de verdade — igual ao N8N)
  const { data: company } = await supabase
    .from('companies')
    .select('agente_ativo, is_active')
    .eq('id', companyId)
    .single()

  if (!company?.agente_ativo) {
    console.warn(`[SDR:${companyId}] loadSdrConfig → NULL: agente_ativo=false na tabela companies`)
    return null
  }
  if (!company?.is_active) {
    console.warn(`[SDR:${companyId}] loadSdrConfig → NULL: is_active=false na tabela companies`)
    return null
  }

  const decryptIfNeeded = (val: string | null | undefined): string => {
    if (!val) return ''
    if (val.includes(':') && val.split(':').length === 3) {
      try { return decrypt(val) } catch { return '' }
    }
    return val
  }

  // Resolve OpenAI key: empresa → platform_config global (via getPlatformConfig) → env
  let resolvedOpenAIKey = decryptIfNeeded(config.openai_key)
  if (!resolvedOpenAIKey) {
    const platformCfg = await getPlatformConfig()
    resolvedOpenAIKey = platformCfg.openai_api_key
  }
  if (!resolvedOpenAIKey) {
    console.warn(`[SDR:${companyId}] loadSdrConfig → AVISO: OpenAI key não encontrada (empresa nem global)`)
  } else {
    console.log(`[SDR:${companyId}] OpenAI key resolvida — termina em ...${resolvedOpenAIKey.slice(-4)}`)
  }
  if (!config.uazapi_token) {
    console.warn(`[SDR:${companyId}] loadSdrConfig → AVISO: uazapi_token vazio no sdr_configs`)
  }

  const resolvedPrompt = flow?.orchestrator_prompt ?? config.prompt ?? ''
  const resolvedVectorConhecimento = flow?.vector_table_conhecimento ?? config.vector_table_conhecimento ?? null
  const resolvedVectorObjecoes = flow?.vector_table_objecoes ?? config.vector_table_objecoes ?? null
  const resolvedConhecimentoAtivo = flow?.conhecimento_ativo ?? config.conhecimento_ativo ?? true
  const resolvedObjecoesAtivo = flow?.objecoes_ativo ?? config.objecoes_ativo ?? false

  console.log(
    `[SDR:${companyId}] config resolvida — flow="${flow?.id ?? 'nenhum'}" ` +
    `prompt=${resolvedPrompt.length}chars ` +
    `conhecimento="${resolvedVectorConhecimento ?? 'documents(default)'}" ` +
    `objecoes="${resolvedVectorObjecoes ?? 'off'}"`
  )

  return {
    agente_ativo: config.agente_ativo,
    uazapi_token: decryptIfNeeded(config.uazapi_token),
    openai_key: resolvedOpenAIKey,
    uazapi_instance_url: config.uazapi_instance_url ?? 'https://nexioai.uazapi.com',
    uazapi_instance_name: config.uazapi_instance_name ?? '',
    agent_type: config.agent_type ?? 'atendimento_venda',
    prompt: resolvedPrompt,
    google_calendar_id: config.google_calendar_id ?? null,
    flowId: flow?.id ?? null,
    vectorTableConhecimento: resolvedVectorConhecimento,
    vectorTableObjecoes: resolvedVectorObjecoes,
    conhecimentoAtivo: resolvedConhecimentoAtivo,
    objecoesAtivo: resolvedObjecoesAtivo,
  }
}

// ─── ENTRY POINTS ──────────────────────────────────────────────

export async function processSdrMessage(companyId: number, phone: string): Promise<void> {
  const supabase = createServiceClient()

  try {
    const cfg = await loadSdrConfig(companyId, supabase, phone)
    if (!cfg) {
      console.warn(`[SDR:${companyId}] processSdrMessage → abortado: loadSdrConfig retornou null (ver aviso acima)`)
      await log(companyId, 'agent_disabled', {}, supabase, phone)
      return
    }
    console.log(`[SDR:${companyId}] processando mensagem de ${phone} — agente="${cfg.agent_type}" flow="${cfg.flowId ?? 'default'}")`)

    // ── Verificar franquia antes de processar ──────────────────
    const quotaCheck = await checkTenantQuota(companyId, supabase)
    if (!quotaCheck.allowed) {
      await pauseTenant(companyId, supabase)
      await log(companyId, 'quota_exceeded', { usedThisMonth: quotaCheck.usedThisMonth, quota: quotaCheck.quota }, supabase, phone)
      return
    }

    const bufferedMessages = await drainBuffer(companyId, phone, supabase)
    if (bufferedMessages.length === 0) return

    const openai = new OpenAI({ apiKey: cfg.openai_key || process.env.OPENAI_API_KEY })

    const { data: company } = await supabase
      .from('companies')
      .select('name')
      .eq('id', companyId)
      .single()

    const senderName = bufferedMessages[0]?.content?.split(' ')[0] ?? ''
    const { id: leadId, notes: leadNotes } = await findOrCreateLead(companyId, phone, senderName, supabase)

    const ctx: SdrContext = {
      companyId,
      companyName: company?.name ?? '',
      leadId,
      leadPhone: phone,
      leadName: senderName,
      conversationId: null,
      uazapiUrl: cfg.uazapi_instance_url,
      uazapiToken: cfg.uazapi_token,
      instanceName: cfg.uazapi_instance_name,
      messageId: bufferedMessages[0]?.messageId ?? '',
      agentType: cfg.agent_type,
      prompt: cfg.prompt,
      openaiKey: cfg.openai_key,
      calendarId: cfg.google_calendar_id,
      flowId: cfg.flowId,
      vectorTableConhecimento: cfg.vectorTableConhecimento,
      vectorTableObjecoes: cfg.vectorTableObjecoes,
      conhecimentoAtivo: cfg.conhecimentoAtivo,
      objecoesAtivo: cfg.objecoesAtivo,
    }

    const conversationId = await ensureConversation(ctx, supabase)
    ctx.conversationId = conversationId

    // Verifica se agente está pausado nesta conversa
    const { data: conv } = await supabase
      .from('conversas_do_whatsapp')
      .select('agente_pausado')
      .eq('id', conversationId)
      .single()

    if (conv?.agente_pausado) {
      await log(companyId, 'agent_paused_conversation', {}, supabase, phone, leadId)
      return
    }

    const combinedText = bufferedMessages.map((m) => m.content).join('\n')
    await saveInbound(conversationId, ctx, combinedText, supabase)

    const history = await getHistory(leadId, companyId, supabase)

    await log(companyId, 'message_received', { messages: bufferedMessages, flowId: cfg.flowId }, supabase, phone, leadId)

    // ── Acumulador de usage — passado por referência a todos os agentes ──
    const acc: UsageAcc = []

    const aiResponse = await runOrchestrator(bufferedMessages, history, ctx, leadNotes, supabase, openai, acc)
    if (!aiResponse) return

    const paragraphs = aiResponse
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter(Boolean)

    await sendWithHumanDelay(paragraphs, phone, cfg.uazapi_instance_url, cfg.uazapi_token, conversationId, ctx, supabase)

    await log(companyId, 'message_sent', { paragraphs, flowId: cfg.flowId }, supabase, phone, leadId)

    // ── Salvar usage_logs e enviar alertas (fire-and-forget) ──
    recordUsage(companyId, acc, supabase, quotaCheck.packageId).catch(console.error)
    checkAndSendQuotaAlerts(companyId, supabase).catch(console.error)
  } catch (err: any) {
    console.error('[SDR Engine] Erro:', err)
    await log(companyId, 'error', {}, supabase, phone, undefined, err?.message ?? 'Erro desconhecido')
  }
}

export async function handleWebhook(companyId: number, body: UazapiWebhookMessage): Promise<boolean> {
  const supabase = createServiceClient()

  try {
    // Evento de conexão/desconexão da instância UAZapi
    const eventType = (body as any).EventType ?? (body as any).event ?? ''
    console.log(`[SDR:${companyId}] webhook recebido — EventType="${eventType}"`)

    if (typeof eventType === 'string' && eventType.toLowerCase().includes('connect')) {
      const rawStatus = (body as any).status ?? (body as any).state ?? (body as any).instance?.status
      const s = typeof rawStatus === 'string' ? rawStatus.toLowerCase() : ''
      const normalized =
        s === 'open' || s === 'connected' || s === 'authenticated' ? 'connected' :
        s === 'close' || s === 'disconnected' || s === 'logout' ? 'disconnected' :
        null
      console.log(`[SDR:${companyId}] evento de conexão — status="${s}" → normalized="${normalized}"`)
      if (normalized) {
        await supabase.from('sdr_configs').update({
          instance_status: normalized,
          ...(normalized === 'disconnected' ? { instance_phone: null } : {}),
        }).eq('company_id', companyId)
      }
      return true
    }

    if (eventType && eventType.toLowerCase() !== 'messages') {
      console.log(`[SDR:${companyId}] ignorado — EventType="${eventType}" não é messages`)
      return false
    }

    if (!body.message) {
      console.log(`[SDR:${companyId}] ignorado — body.message ausente`)
      return false
    }

    if (body.message?.fromMe) {
      console.log(`[SDR:${companyId}] ignorado — fromMe=true`)
      return false
    }

    const msg = body.message as any
    const text = msg?.text
      || msg?.conversation
      || msg?.extendedTextMessage?.text
      || msg?.body
      || body.chat?.wa_lastMessageTextVote
      || ''

    if (!text.trim()) {
      console.warn(`[SDR:${companyId}] ignorado — texto vazio. Campos presentes no message:`, Object.keys(msg ?? {}))
      return false
    }

    console.log(`[SDR:${companyId}] mensagem de ${body.chat?.phone} — texto="${text.slice(0, 80)}"${text.length > 80 ? '…' : ''}`)

    if (isPromptInjection(text)) {
      const uazapi = createUazapiClient(
        body.BaseUrl ?? 'https://nexioai.uazapi.com',
        body.token ?? ''
      )
      await uazapi.blockContact(normalizePhone(body.chat.phone)).catch(() => {})
      await log(companyId, 'injection_blocked', { text }, supabase, body.chat.phone)
      return false
    }

    const phone = normalizePhone(body.chat.phone)
    const messageId = body.message.id ?? body.message.messageid

    // Deduplicação por messageId
    const { data: dup } = await supabase
      .from('sdr_message_buffer')
      .select('messages')
      .eq('company_id', companyId)
      .eq('phone', phone)
      .maybeSingle()

    if (dup?.messages) {
      const msgs = dup.messages as BufferedMessage[]
      if (msgs.some((m) => m.messageId === messageId)) return false
    }

    const bufferedMsg: BufferedMessage = {
      content: text,
      type: detectMessageType(body.message),
      timestamp: new Date().toISOString(),
      messageId,
    }

    await bufferMessage(companyId, phone, bufferedMsg, supabase)

    // Aguarda 3s (batching de mensagens rápidas) e processa
    await new Promise((r) => setTimeout(r, 3000))
    await processSdrMessage(companyId, phone)

    return true
  } catch (err: any) {
    console.error('[SDR Webhook] Erro:', err)
    return false
  }
}

export async function resolveCompanyByInstance(instanceName: string): Promise<number | null> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('companies')
    .select('id')
    .eq('whatsapp_instance_name', instanceName)
    .maybeSingle()
  return data?.id ?? null
}
