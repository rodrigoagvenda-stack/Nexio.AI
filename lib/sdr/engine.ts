/**
 * SDR Engine : Orquestrador multi-agente fiel ao fluxo N8N.
 *
 * Arquitetura:
 *   Orquestrador (GPT-4.1) →
 *     Think | RAG Conhecimento | RAG Objeções |
 *     Agente Pipeline | Agente Segmentação |
 *     Agente Outbound | Memory Expert |
 *     Agente Agendamento (Google Calendar : opcional)
 */

import { createServiceClient } from '@/lib/supabase/server'
import { syslog } from '@/lib/logger'
import { decrypt, safeDecrypt } from '@/lib/crypto'
import { getPlatformConfig } from '@/lib/platform-config'
import { createUazapiClient, normalizePhone, detectMessageType, extractCtwaReferral, type UazapiWebhookMessage } from './uazapi'
import { markOptOut } from './outbound'
import { persistMediaToStorage } from './media-storage'
import { ingestInboundMessage, type NormalizedInboundEvent } from './inbound'
import { canSendFreeform } from './window'
import { getWindowStateForConversation, maybeStampFirstCtwaReply } from './window-server'
import { isWithinBusinessHours, getBusinessHoursSummary } from './business-hours'
import { findOrCreateCustomer, createCharge, createSubscription, getSubscriptionFirstPaymentUrl, getPixQrCode, type BillingType } from '@/lib/asaas/company-client'
import { sendText } from './whatsapp-sender'
import { distributeQueuedConversations } from './distribute'
import {
  checkAvailableSlots,
  createEventWithMeet,
  cancelEvent,
  getEvent,
  formatDateTimeBR,
  nextBusinessDay,
  isBusinessDay,
  parseBrazilDateTime,
} from '@/lib/google-calendar'
import type OpenAI from 'openai'  // type-only: apagado em compile-time, sem impacto no bundle

// Cache de clientes OpenAI por chave : evita criar nova instância (e conexões HTTP) a cada mensagem
const _openaiCache = new Map<string, OpenAI>()
async function getOpenAIClient(apiKey: string): Promise<OpenAI> {
  if (!_openaiCache.has(apiKey)) {
    const { default: OpenAIClass } = await import('openai')
    _openaiCache.set(apiKey, new OpenAIClass({ apiKey }))
  }
  return _openaiCache.get(apiKey)!
}
import {
  type UsageAcc,
  checkTenantQuota,
  recordUsage,
  pauseTenant,
  checkAndSendQuotaAlerts,
} from '@/lib/billing/usage'
import { sendInjectionAlertEmail } from '@/lib/email/resend'

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
  eventTitleTemplate: string | null
  businessHoursSummary: string
  asaasAtivo: boolean
  billingRecurring: boolean
  placesAnalysisAtivo: boolean
  briefingLinkPending: boolean
}

export interface BufferedMessage {
  content: string
  type: string
  timestamp: string
  messageId: string
  mediaUrl?: string
  senderName?: string
  senderPhoto?: string
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

// ─── Prompt Injection Security (espelha Prompt Injection Security1 do N8N) ───

const CRITICAL_PATTERNS = [
  // Direct Override - English
  /ignore\s+(previous|all|above|earlier|prior)\s*(instructions?|prompts?|rules?|directives?)/i,
  /forget\s+(everything|all|previous|earlier)\s*(instructions?|prompts?|context?)/i,
  /disregard\s+(previous|all|above|earlier)\s*(instructions?|rules?|prompts?)/i,
  // Direct Override - Portuguese
  /esqueç[ao]\s+(tud[ao]|todas?|anteriores?)\s*(as\s+)?(suas\s+)?(instruções?|configuraç[õo]es?|regras?|prompts?|contexto)/i,
  /ignorar?\s+(tud[ao]|todas?|anteriores?)\s*(as\s+)?(suas\s+)?(instruções?|regras?|prompts?)/i,
  /desconsiderar?\s+(tud[ao]|todas?|anteriores?)\s*(as\s+)?(suas\s+)?(instruções?|regras?)/i,
  // Role Change - English
  /you\s+are\s+now\s+(a\s+)?(jailbreak|hacker|admin|developer|god|root|system)/i,
  /(pretend|act|behave|roleplay)\s+(like|as|to\s+be)\s+(a\s+)?(hacker|admin|system|developer)/i,
  /from\s+now\s+on\s+you\s+(are|will\s+be|should\s+act)/i,
  // Role Change - Portuguese
  /(você|vc)\s+(é|sera|deve\s+ser)\s+(um[a]?|uma)\s+.{1,30}/i,
  /(agora|partir\s+de\s+agora)\s+você\s+(é|sera)/i,
  /(atue|aja|comporte|interprete)\s+como\s+(um[a]?|uma)/i,
  /finja\s+(ser|que\s+(é|voce\s+é))\s+(um[a]?|uma)/i,
  // System Command Injection
  /<\|.*?(start|end|system|user|assistant).*?\|>/gi,
  /\[\s*(system|admin|root|debug)\s*\]/i,
  /#\s*(system|admin|config|debug|override)/i,
  // Template Injection
  /\{\{.*?(eval|exec|system|import|require|process).*?\}\}/i,
  /\$\{.*?(eval|exec|system|process).*?\}/i,
  /<%.*?(eval|exec|system).*?%>/i,
  // Encoding Attacks
  /base64\s*[:=]\s*[A-Za-z0-9+/]{30,}/i,
  /hex\s*[:=]\s*[0-9a-fA-F]{40,}/i,
  /unicode\s*[:=]\s*\\u[0-9a-fA-F]{4,}/i,
  // Meta-Prompt - English
  /show\s+me\s+(your|the)\s+(prompt|instructions|system\s+message)/i,
  /what\s+(are|were)\s+your\s+(original|initial)\s+(instructions|prompt)/i,
  /reveal\s+(your|the)\s+(prompt|instructions|system)/i,
  // Meta-Prompt - Portuguese
  /(mostre|revele|me\s+diga)\s+(suas?|as|o)\s+(instruções?|prompt|configurações?|sistema)/i,
  /quais?\s+s[ãa]o\s+(suas?|as)\s+(instruções?|regras?|diretrizes?)\s+(originais?|iniciais?)/i,
  // Code Execution Disguised
  /```[\s\S]*?(eval|exec|system|import\s+os|subprocess)[\s\S]*?```/i,
  /execute\s+the\s+following\s+(code|script|command)/i,
  /(execute|rode|processe)\s+(o\s+)?(seguinte|este)\s+(código|script|comando)/i,
  // Developer/Debug Mode - English
  /(developer|debug|admin|maintenance)\s+mode\s+(on|enabled|true)/i,
  /enable\s+(debug|developer|admin|god)\s+mode/i,
  // Developer/Debug Mode - Portuguese
  /modo\s+(desenvolvedor|debug|admin|manutenção)\s+(ativado|ligado|on)/i,
  /(ativar|habilitar|ligar)\s+modo\s+(desenvolvedor|debug|admin)/i,
]

const HIGH_RISK_KEYWORDS = [
  'ignore instructions', 'forget everything', 'disregard previous',
  'override system', 'bypass security', 'jailbreak mode',
  'you are now', 'act as', 'pretend to be', 'roleplay as',
  'from now on', 'new instructions', 'update your role',
  'system:', 'admin:', 'root:', 'sudo:', 'config:',
  'prompt:', 'instructions:', 'directives:', 'rules:',
  'eval(', 'exec(', 'system(', 'import os', 'subprocess',
  'document.', 'window.', 'process.', 'require(',
  'emergency override', 'developer access', 'debug session',
  'authorized by', 'special permission', 'urgent request',
  'ignorar instruções', 'esquecer tudo', 'modo desenvolvedor',
  'acesso admin', 'sistema:', 'configuração:', 'emergência',
]

const SUSPICIOUS_PATTERNS = [
  /tell\s+me\s+about\s+your\s+(training|design|architecture)/i,
  /how\s+(were\s+you|are\s+you)\s+(made|created|built|trained)/i,
  /what\s+(can|cannot)\s+you\s+(do|not\s+do|never\s+do)/i,
  /(simulate|emulate|mimic)\s+(a\s+)?(computer|terminal|shell)/i,
  /if\s+you\s+were\s+(not\s+)?(an\s+ai|constrained|limited)/i,
]

const HIGH_ENTROPY_THRESHOLD = 4.5
const BLOCK_CONFIDENCE = 0.75
const SUSPICIOUS_CONFIDENCE = 0.4

function calcEntropy(text: string): number {
  if (!text.length) return 0
  const freq: Record<string, number> = {}
  for (const c of text) freq[c] = (freq[c] ?? 0) + 1
  let e = 0
  for (const k in freq) {
    const p = freq[k] / text.length
    e -= p * Math.log2(p)
  }
  return Math.round(e * 100) / 100
}

export function isPromptInjection(text: string): boolean {
  if (!text) return false

  // LAYER 1: critical patterns : bloqueio imediato (espelha CRITICAL_PATTERNS do n8n)
  for (const p of CRITICAL_PATTERNS) {
    if (p.test(text)) return true
  }

  // LAYER 2: keyword scoring
  const lower = text.toLowerCase()
  let keywordScore = 0
  for (const kw of HIGH_RISK_KEYWORDS) {
    if (lower.includes(kw.toLowerCase())) keywordScore += 0.3
  }

  // LAYER 3: structural scoring
  let structuralScore = 0
  if (text.length > 4000) structuralScore += 0.3
  const specialRatio = (text.match(/[^a-zA-Z0-9\sÀ-ÿ]/g) ?? []).length / text.length
  if (specialRatio > 0.4) structuralScore += 0.3
  if ((text.match(/[{}]/g) ?? []).length > 10) structuralScore += 0.3
  if ((text.match(/[<>]/g) ?? []).length > 6) structuralScore += 0.2
  if ((text.match(/[|&;`$]/g) ?? []).length > 3) structuralScore += 0.4

  // LAYER 4: entropy scoring
  const entropy = calcEntropy(text)
  const entropyScore = entropy > HIGH_ENTROPY_THRESHOLD
    ? Math.min((entropy - HIGH_ENTROPY_THRESHOLD) * 0.2, 0.4)
    : 0

  // LAYER 5: suspicious patterns
  let suspiciousScore = 0
  for (const p of SUSPICIOUS_PATTERNS) {
    if (p.test(text)) suspiciousScore += 0.2
  }

  // LAYER 6: context
  let contextScore = 0
  if (/[​-‏⁠﻿]/.test(text)) contextScore += 0.4 // hidden chars

  const total = Math.min(keywordScore + structuralScore + entropyScore + suspiciousScore + contextScore, 0.98)
  return total >= BLOCK_CONFIDENCE
}

// Padrões de opt-out do lead pedindo pra não receber mais mensagens de
// outbound (disparo frio). Ao contrário de isPromptInjection, uma detecção
// aqui NÃO descarta a mensagem : ela segue o fluxo normal (ingestInboundMessage),
// só dispara markOptOut em paralelo pra bloquear futuros disparos.
const OPT_OUT_PATTERNS = [
  /\bpar(?:e|a|ar)\s+de\s+(?:me\s+)?mandar/i,
  /\bpar(?:e|a|ar)\s+de\s+(?:me\s+)?chamar/i,
  /\bn(?:ã|a)o\s+quero\s+(?:mais\s+)?(?:receber|mensage|informa[cç][aã]o|informa[cç][oõ]es|saber|nada)/i,
  /\bn(?:ã|a)o\s+tenho\s+interesse/i,
  /\bn(?:ã|a)o\s+preciso(?:\s+mais)?/i,
  /\bremov(?:e|er|a)\s+(?:o\s+)?(?:meu\s+)?(?:contato|n[uú]mero)/i,
  /\bdescadastr/i,
  /\bcancelar\s+(?:a\s+)?inscri[cç][aã]o/i,
  /\bsa(?:i|ir)\s+da\s+lista/i,
  /\bn(?:ã|a)o\s+me\s+(?:mand|escrev|chame|contate)/i,
  /^\s*(?:stop|unsubscribe)\s*$/i,
]

export function isOptOutRequest(text: string): boolean {
  if (!text) return false
  return OPT_OUT_PATTERNS.some((p) => p.test(text))
}

// ─── Buffer (Supabase) ────────────────────────────────────────

export async function bufferMessage(
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

// ─── RAG : Busca vetorial no Supabase ─────────────────────────

const SIMILARITY_MIN = 0.75 // achado 6 da auditoria RAG : piso pra não formular resposta em cima de lixo
const RERANK_CANDIDATES = 16 // achado 1/7 : busca mais candidatos pra filtrar por tipo e reordenar por relevância

/** Overlap de palavras relevantes (>3 letras) entre query e conteúdo : reranking leve, sem chamada de IA extra */
function keywordOverlapScore(query: string, content: string): number {
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const queryWords = new Set(norm(query).split(/\W+/).filter((w) => w.length > 3))
  if (queryWords.size === 0) return 0
  const contentNorm = norm(content)
  let hits = 0
  for (const w of queryWords) if (contentNorm.includes(w)) hits++
  return hits / queryWords.size
}

async function searchDocuments(
  query: string,
  companyId: number,
  openai: OpenAI,
  supabase: ReturnType<typeof createServiceClient>,
  docType: 'conhecimento' | 'objecoes'
): Promise<string> {
  console.log(`[SDR:${companyId}] RAG search : tipo="${docType}" query="${query.slice(0, 60)}"`)
  try {
    const embRes = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
    })
    const embedding = embRes.data[0].embedding

    const { data, error } = await supabase.rpc('match_documents', {
      query_embedding: embedding,
      match_count: RERANK_CANDIDATES,
      filter: { company_id: companyId },
    })

    if (error) {
      console.error(`[SDR:${companyId}] RAG error:`, error.message)
      return ''
    }
    if (!data || data.length === 0) return ''

    const rows = data as Array<{ content: string; similarity?: number }>
    const tag = `[[DOC_TYPE:${docType}]]\n`
    let typed = rows.filter((d) => d.content.startsWith(tag)).map((d) => ({ ...d, content: d.content.slice(tag.length) }))

    // Fallback : base antiga sem tag (gerada antes desse fix) — usa tudo sem
    // filtrar por tipo, do jeito que já funcionava antes, pra não zerar a
    // resposta de empresa que ainda não regenerou a base.
    let usedFallback = false
    if (typed.length === 0) {
      usedFallback = true
      typed = rows.filter((d) => !/^\[\[DOC_TYPE:/.test(d.content))
    }

    // Piso de similaridade (achado 6), só quando a RPC devolve o campo
    const withThreshold = typeof typed[0]?.similarity === 'number'
      ? typed.filter((d) => (d.similarity ?? 0) >= SIMILARITY_MIN)
      : typed
    const pool = withThreshold.length > 0 ? withThreshold : typed

    // Reranking leve por overlap de palavras-chave (achado 7), combinado com
    // a similaridade vetorial quando disponível
    const ranked = pool
      .map((d) => ({ ...d, _score: (d.similarity ?? 0.5) + keywordOverlapScore(query, d.content) }))
      .sort((a, b) => b._score - a._score)
      .slice(0, 4)

    // O bloco de Fechamento (link/CTA de conversão) nem sempre bate por
    // similaridade semântica com a pergunta do lead : achado ao vivo
    // (2026-09-02) que "preciso de manutenção, num é isso?" (intenção clara
    // de compra) não trouxe o bloco === FECHAMENTO === porque a query
    // gerada pela IA foi educativa, não usava palavras de fechamento. Em vez
    // de depender só da busca acertar, o bloco de Fechamento SEMPRE entra
    // junto quando existe pra empresa : as regras de "não repita link já
    // enviado"/"só use quando fizer sentido" já existentes no wizard seguem
    // controlando quando o modelo realmente usa isso.
    if (docType === 'conhecimento' && !ranked.some((d) => d.content.includes('=== FECHAMENTO ==='))) {
      const closing = typed.find((d) => d.content.includes('=== FECHAMENTO ==='))
      if (closing) ranked.push({ content: closing.content, similarity: closing.similarity, _score: 0 })
    }

    console.log(`[SDR:${companyId}] RAG results: ${ranked.length} docs (fallback sem tag: ${usedFallback})`)
    if (ranked.length === 0) return ''
    return ranked.map((d) => d.content).join('\n\n')
  } catch (e: any) {
    console.error(`[SDR:${companyId}] RAG exception:`, e.message)
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
    .order('carimbo_de_data_e_hora', { ascending: false })
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
  maxIterations = 10,
  history: ChatMsg[] = [],
  abortOnResult?: (toolName: string, result: string) => string | null
): Promise<string> {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...history,
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
      if (abortOnResult) {
        const abort = abortOnResult(fnCall.name, result)
        if (abort !== null) return abort
      }
      messages.push({ role: 'tool', tool_call_id: tc.id, content: result })
    }
  }

  return 'Agente atingiu limite de iterações'
}

/** Extrai email de qualquer mensagem do histórico */
function extractEmailFromHistory(history: ChatMsg[]): string | undefined {
  for (const msg of [...history].reverse()) {
    const m = String(msg.content).match(/\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/)
    if (m) return m[0]
  }
  return undefined
}

/** Extrai datetime confirmado de mensagens como "quinta-feira, 08/05 às 9h : confirma?" */
function parseConfirmedDateTime(text: string): Date | null {
  const m = text.match(/(\d{2})\/(\d{2})\s+às\s+(\d{1,2})(?:h(\d{2})?|:(\d{2}))/)
  if (!m) return null
  const day = parseInt(m[1])
  const month = parseInt(m[2]) - 1
  const hour = parseInt(m[3])
  const min = parseInt(m[4] ?? m[5] ?? '0') || 0
  const year = new Date().getFullYear()
  const pad = (n: number) => String(n).padStart(2, '0')
  const isoStr = `${year}-${pad(month + 1)}-${pad(day)}T${pad(hour)}:${pad(min)}:00`
  const dt = parseBrazilDateTime(isoStr)
  if (dt < new Date()) {
    return parseBrazilDateTime(`${year + 1}-${pad(month + 1)}-${pad(day)}T${pad(hour)}:${pad(min)}:00`)
  }
  return dt
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
    tools, handlers, openai, 'gpt-4.1', acc, 'pipeline'
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
2. Use "Think" para raciocinar: a mensagem do lead revela explicitamente o tipo de negócio ou setor em que atua? Ex: "tenho uma padaria", "sou advogado", "trabalho com estética". Objeções, perguntas sobre preço, saudações e dúvidas genéricas NÃO revelam segmento.
3. SOMENTE se a mensagem contiver informação real de segmento: use "Atualizar_nincho". Caso contrário, retorne imediatamente {"atualizado": false, "segmento": ""}.

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
    tools, handlers, openai, 'gpt-4.1', acc, 'segmentacao'
  )
}

async function runAgenteOutbound(
  message: string,
  ctx: SdrContext,
  openai: OpenAI,
  supabase: ReturnType<typeof createServiceClient>,
  acc?: UsageAcc
): Promise<string> {
  const systemPrompt = `Você é o Agente de Contexto Outbound. Sua função é identificar a origem do lead e fornecer contexto completo para o SDR.

⚠️ ATENÇÃO: Você TEM tools disponíveis. Use-as OBRIGATORIAMENTE. NUNCA responda sem usar as tools.

PASSO 1 : USE AGORA a tool "Buscar_origem_lead_no_supabase" passando whatsapp e company_id:
- Se status = "Outbound" → lead veio de abordagem ativa, vá para PASSO 2
- Se diferente → lead inbound, vá direto para o RETORNO FINAL com origem = "inbound"
- Verifique a coluna "briefing_preenchido":
  - true → lead já preencheu o briefing
  - false → briefing ainda não preenchido

PASSO 2 : USE AGORA a tool "Buscar_mensagem_enviada_outbound" passando lead_id e company_id:
- Retorna a mensagem que foi enviada ao lead
- OBRIGATÓRIO se lead for outbound

PASSO 3 : USE AGORA a tool "Salvar_resposta_e_score_do_lead" passando lead_id e company_id com:
- respondeu: true
- respondeu_em: data/hora atual
- mensagem_recebida: mensagem que o lead enviou
- score_interesse: analise o tom e atribua de 1 a 10:
  - 1-3: desinteressado, pediu para parar, ignorou
  - 4-6: neutro, perguntou algo básico
  - 7-9: demonstrou interesse, fez perguntas relevantes
  - 10: pediu proposta, quer agendar

VALIDAÇÃO : Antes de retornar confirme:
✅ Usei "Buscar_origem_lead_no_supabase"? Se não → use agora
✅ Se outbound, usei "Buscar_mensagem_enviada_outbound"? Se não → use agora
✅ Usei "Salvar_resposta_e_score_do_lead"? Se não → use agora

RETORNO FINAL : somente após usar todas as tools:
{
  "origem": "outbound | inbound",
  "mensagem_enviada": "texto ou null",
  "score_interesse": número ou null,
  "briefing_preenchido": true | false
}`

  const tools: OpenAI.Chat.ChatCompletionTool[] = [
    {
      type: 'function',
      function: {
        name: 'Think7',
        description: 'Use para pensar sobre algo. Não obtém novas informações nem altera o banco. Use quando precisar de raciocínio complexo.',
        parameters: { type: 'object', properties: { thought: { type: 'string' } }, required: ['thought'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'Buscar_origem_lead_no_supabase',
        description: 'Busca a origem e status atual do lead pelo whatsapp e company_id',
        parameters: { type: 'object', properties: { whatsapp: { type: 'string' }, company_id: { type: 'number' } }, required: ['whatsapp'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'Buscar_mensagem_enviada_outbound',
        description: 'Busca a mensagem outbound original que foi enviada ao lead',
        parameters: { type: 'object', properties: { lead_id: { type: 'number' }, company_id: { type: 'number' } }, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'Salvar_resposta_e_score_do_lead',
        description: 'Salva a resposta do lead e o score de interesse (1-10) na campanha outbound',
        parameters: {
          type: 'object',
          properties: {
            respondeu: { type: 'boolean' },
            respondeu_em: { type: 'string' },
            mensagem_recebida: { type: 'string' },
            score_interesse: { type: 'number' },
          },
          required: ['respondeu', 'respondeu_em', 'mensagem_recebida', 'score_interesse'],
        },
      },
    },
  ]

  const handlers: Record<string, (args: any) => Promise<string>> = {
    'Think7': async (args) => `Raciocínio registrado: ${args.thought}`,
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
          mensagem_recebida: args.mensagem_recebida,
          score_interesse: args.score_interesse,
        })
        .eq('company_id', ctx.companyId)
        .eq('whatsapp', ctx.leadPhone)
      return JSON.stringify({ salvo: true, score_interesse: args.score_interesse })
    },
  }

  return runAgentLoop(
    systemPrompt,
    `WhatsApp do lead: ${ctx.leadPhone}\nCompany ID: ${ctx.companyId}\nMensagem recebida: ${message}`,
    tools, handlers, openai, 'gpt-4.1', acc, 'outbound'
  )
}

async function runMemoryExpert(
  info: string,
  ctx: SdrContext,
  openai: OpenAI,
  supabase: ReturnType<typeof createServiceClient>,
  acc?: UsageAcc
): Promise<string> {
  const systemPrompt = `Você é o Agente de Registro. Sua função é consolidar informações do lead e atualizar o CRM após cada interação.

IMPORTANTE: Só atualize um campo se tiver informação nova relevante. Nunca atualize segment, priority ou nivel_interesse se a conversa não tiver dados suficientes para determinar isso com certeza.

FERRAMENTAS DISPONÍVEIS:
- "Think4": use para raciocinar antes de qualquer atualização
- "Buscar_lead": busca os dados atuais do lead no CRM usando o whatsapp como identificador único
- "Atualizar_resumo": atualiza os campos do lead no CRM

ORDEM DE EXECUÇÃO OBRIGATÓRIA:
1. Use "Think4" para raciocinar sobre o que precisa ser atualizado
2. Use "Buscar_lead" passando o número do whatsapp do lead
3. Compare os dados atuais com a nova informação recebida
4. Use "Think4" novamente para consolidar o que vai atualizar
5. Use "Atualizar_resumo" para salvar as atualizações no CRM

CAMPOS QUE VOCÊ ATUALIZA:
- resumo_ia: resumo executivo da conversa
- segment: segmento do lead
- priority: prioridade do lead
- nivel_interesse: temperatura do lead
- updated_at: sempre atualizar com a data/hora atual
- checklist_atendimento: campos ESTRUTURADOS que nunca degradam com o tempo (diferente do resumo_ia, que prioriza o novo sobre o antigo). É o que impede a Zaia de se apresentar de novo ou repetir pergunta já respondida depois de muitas mensagens.

CHECKLIST_ATENDIMENTO (sempre confira o que "Buscar_lead" já retornou antes de decidir o que enviar) :
- apresentacao_feita: marque true assim que a Zaia se apresentar pela primeira vez nesta conversa. Uma vez true, NUNCA marque false de novo.
- nova_pergunta_respondida: SEMPRE que o lead responder uma pergunta de qualificação nova (segmento, volume, decisor, orçamento, prazo, etc), registre como {"pergunta": "rótulo curto", "resposta": "o que ele disse"}. Não repita rótulo já existente : se for atualização do mesmo tema, é normal registrar de novo com o mesmo rótulo.
- estagio_atual: rótulo curto do estágio da conversa (ex: "qualificando", "apresentando_solucao", "objecao_preco", "fechamento").

REGRAS DO RESUMO (resumo_ia):
- Máximo 200 palavras
- Use bullet points
- Inclua: interesse demonstrado, objeções, próximos passos, informações relevantes
- Priorize informações novas sobre antigas
- Seja direto : o SDR precisa entender em 30 segundos

NÍVEL DE INTERESSE (use exatamente assim):
- "Quente 🔥"
- "Morno 🌡️"
- "Frio ❄️"

PRIORIDADE (use exatamente assim) — critério objetivo, não é opinião:
- "Alta": pelo menos UM destes sinais está presente na conversa:
  · urgência declarada pelo lead ("preciso pra já", "quero resolver essa semana", "hoje mesmo")
  · nível de interesse "Quente 🔥"
  · pediu ou aceitou o link de teste / demonstrou intenção clara de avançar (agendar, testar, comprar)
  · confirmou orçamento/ticket compatível sem levantar objeção de preço
- "Média": lead engajado (responde, faz perguntas sobre o produto), nível de interesse "Morno 🌡️", mas sem nenhum sinal de urgência ou intenção de avançar ainda
- "Baixa": lead pouco engajado (respostas curtas, frias, genéricas), nível de interesse "Frio ❄️", objeção forte sem resolução, ou sinal de que não é o momento
Se não houver sinal suficiente pra nenhuma das três, NÃO atualize o campo — mantenha o valor atual do lead.

SEGMENTOS (use exatamente assim):
- "E-commerce", "Saúde/Medicina", "Educação", "Alimentação", "Beleza/Estética", "Imobiliária", "Advocacia", "Consultoria", "Tecnologia", "Moda/Fashion", "Arquitetura", "Outros"

NUNCA invente valores fora dos listados acima.
Se não tiver certeza de um campo, mantenha o valor atual do lead.`

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
        description: 'Atualiza os campos do lead no CRM, incluindo o checklist estruturado de atendimento',
        parameters: {
          type: 'object',
          properties: {
            resumo_ia: { type: 'string' },
            segment: { type: 'string' },
            priority: { type: 'string', enum: ['Alta', 'Média', 'Baixa'] },
            nivel_interesse: { type: 'string', enum: ['Quente 🔥', 'Morno 🌡️', 'Frio ❄️'] },
            apresentacao_feita: { type: 'boolean', description: 'true assim que a Zaia se apresentar pela primeira vez nesta conversa' },
            nova_pergunta_respondida: {
              type: 'object',
              properties: {
                pergunta: { type: 'string', description: 'Rótulo curto, ex: segmento, volume_mensagens, decisor, orcamento, prazo' },
                resposta: { type: 'string', description: 'O que o lead respondeu' },
              },
            },
            estagio_atual: { type: 'string', description: 'Rótulo curto do estágio da conversa, ex: qualificando, apresentando_solucao, fechamento' },
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
      let checklist_atendimento: any = null
      if (ctx.conversationId) {
        const { data: conv } = await supabase
          .from('conversas_do_whatsapp')
          .select('checklist_atendimento')
          .eq('id', ctx.conversationId)
          .maybeSingle()
        checklist_atendimento = conv?.checklist_atendimento ?? null
      }
      return JSON.stringify({ ...(data ?? {}), checklist_atendimento })
    },
    'Atualizar_resumo': async (args) => {
      const updates: Record<string, any> = { updated_at: new Date().toISOString() }
      if (args.resumo_ia) updates.resumo_ia = args.resumo_ia
      if (args.segment) updates.segment = args.segment
      if (args.priority) updates.priority = args.priority
      if (args.nivel_interesse) updates.nivel_interesse = args.nivel_interesse

      // Checklist estruturado : merge com o que já existe, nunca sobrescreve
      // apagando (apresentacao_feita só vira true e fica true; perguntas novas
      // se acumulam na lista, sem duplicar rótulo).
      if (ctx.conversationId && (args.apresentacao_feita || args.nova_pergunta_respondida || args.estagio_atual)) {
        const { data: convAtual } = await supabase
          .from('conversas_do_whatsapp')
          .select('checklist_atendimento')
          .eq('id', ctx.conversationId)
          .maybeSingle()
        const atual = (convAtual?.checklist_atendimento as ChecklistAtendimento) ?? {}
        const perguntas = atual.perguntas_e_respostas ?? []
        if (args.nova_pergunta_respondida?.pergunta) {
          const idx = perguntas.findIndex((p) => p.pergunta === args.nova_pergunta_respondida.pergunta)
          if (idx >= 0) perguntas[idx] = args.nova_pergunta_respondida
          else perguntas.push(args.nova_pergunta_respondida)
        }
        const novoChecklist: ChecklistAtendimento = {
          apresentacao_feita: atual.apresentacao_feita || !!args.apresentacao_feita,
          perguntas_e_respostas: perguntas,
          estagio_atual: args.estagio_atual ?? atual.estagio_atual,
        }
        await supabase.from('conversas_do_whatsapp').update({ checklist_atendimento: novoChecklist }).eq('id', ctx.conversationId)
      }

      const { data: updated } = await supabase
        .from('leads')
        .update(updates)
        .eq('id', ctx.leadId)
        .select('resumo_ia, segment, priority, nivel_interesse')
        .single()

      // Snapshot pra histórico só quando o resumo em si mudou -- evita
      // ficar guardando entrada nova toda vez que só priority/segment
      // mexem sozinhos, sem novidade real de contexto pra revisar depois.
      if (args.resumo_ia && updated) {
        await supabase.from('lead_resumo_history').insert({
          company_id: ctx.companyId,
          lead_id: ctx.leadId,
          resumo_ia: updated.resumo_ia,
          segment: updated.segment,
          priority: updated.priority,
          nivel_interesse: updated.nivel_interesse,
        })
      }

      return JSON.stringify({ atualizado: true, campos: Object.keys(updates) })
    },
  }

  return runAgentLoop(
    systemPrompt,
    `WhatsApp do lead: ${ctx.leadPhone}\nNova informação: ${info}`,
    tools, handlers, openai, 'gpt-4.1', acc, 'memory'
  )
}

/** Agente de Agendamento : Google Calendar + Meet */
async function runAgenteAgendamento(
  message: string,
  ctx: SdrContext,
  openai: OpenAI,
  supabase: ReturnType<typeof createServiceClient>,
  acc?: UsageAcc,
  history: ChatMsg[] = []
): Promise<string> {
  if (!ctx.calendarId) {
    return 'Agendamento não configurado para esta empresa. Peça ao administrador para configurar o Google Calendar.'
  }

  const now = new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })

  const systemPrompt = `Você é um assistente de agendamento comercial da Nexio.AI. Seu jeito é caloroso, gentil e eficiente. Trate o lead pelo nome sempre que possível e demonstre genuíno entusiasmo em agendar a call.
Data e hora atual: ${now}

⛔ GUARDA-CHUVA (verifique ANTES de tudo) : você SÓ sabe marcar/remarcar/cancelar reunião no Google Calendar. Você NÃO conhece o produto do cliente, NÃO tem link de teste grátis, NÃO envia e-mail e NÃO libera cadastro nenhum.
Se a "nova_informacao_agendamento" recebida NÃO for claramente um pedido de marcar/remarcar/cancelar uma REUNIÃO ou CALL com data e hora (por exemplo, for sobre teste grátis, link, cadastro, dúvida de produto ou preço), NÃO simule nenhum fluxo, NÃO invente prazo nem promessa de envio de nada. Responda apenas, em uma linha: "Isso não é um agendamento de reunião, vou verificar a forma correta de te ajudar com isso." e pare — não chame nenhuma tool.

FLUXO DE AGENDAMENTO (só se passou pelo guarda-chuva acima):
0. VERIFIQUE O HISTÓRICO ANTES DE QUALQUER AÇÃO:
   - O input pode conter histórico da conversa. Leia tudo antes de agir.
   - Se no histórico existe uma mensagem sua no formato "[Nome], [dia] [data] às [hora], confirma?" E a última mensagem do lead foi "sim", "pode", "ok", "confirmo", "tá bom" ou qualquer afirmação → PARE. Verifique se já tem nome completo E email no histórico. Se sim: vá direto para "Agendar_gcal". Se não: vá para o passo 4.5 agora.
   - Só inicie o fluxo do passo 1 se não houver confirmação pendente no histórico.
1. "Hora_atual" → obter data/hora exata
2. "Buscar_reuniao" → já confirma sozinho, no Google Calendar de verdade (não só no banco), se existe uma reunião válida. Use o campo "reuniao_valida" da resposta, ele já é a resposta final e definitiva, NÃO precisa chamar "Consultar_gcal" de novo só pra confirmar isso:
   - reuniao_valida=true → informe a reunião existente de forma simpática (use call_agendada_para/meet_url da resposta) e pergunte se quer reagendar
   - reuniao_valida=false → trate como SEM nenhum agendamento (mesmo que call_de_venda esteja true no banco : o motivo pode ser "evento_nao_existe_mais_no_calendario" ou "horario_ja_passou", ambos = sem reunião válida pra apresentar) e vá direto para o passo 4
   - NUNCA diga "já temos uma reunião marcada" sobre um horário que já passou. Se motivo="horario_ja_passou" ou "evento_nao_existe_mais_no_calendario", é como se não houvesse reunião nenhuma.
4. "Consultar_gcal" → verificar conflitos no calendário (pra achar/confirmar um NOVO horário, não pra reconferir a reunião do passo 2)
   - Se o lead JÁ informou dia e/ou horário desejado:
     → Consulte especificamente esse dia/horário
     → Se livre → vá direto para o passo 4.5
     → Se ocupado → informe e peça outro horário
   - Se o lead NÃO informou horário:
     → Consulte os próximos 3 dias úteis
     → Retorno vazio = dia livre, todos os horários entre 9h e 18h disponíveis
     → Retorno com eventos = considere apenas horários não conflitantes
     → Sugira 3 opções em UMA única mensagem animada e aguarde a escolha
4.5. ⛔ COLETA OBRIGATÓRIA : NUNCA PULE ESTE PASSO:
   - Você DEVE ter nome completo, email E objetivo da call do lead.
   - Verifique o histórico: o lead já forneceu os três itens explicitamente?
     → Se SIM: prossiga para o passo 5.
     → Se NÃO: pergunte em UMA mensagem: "Para enviar o convite, preciso do seu nome completo, e-mail e qual o objetivo da call 😊"
   - PARE e aguarde a resposta. NÃO avance sem ter os três dados.
   - ⚠️ PENALIDADE: Chamar "Agendar_gcal" sem email e nome_completo é uma falha crítica. Nunca faça isso.
5. Confirmar: "[Nome], [dia da semana] [data] às [hora], confirma?"
6. "Agendar_gcal" → criar evento com Meet ativado, passando email e nome_completo coletados
7. "Reuniao_marcada" → atualizar CRM

FLUXO DE CANCELAMENTO:
- Se o lead pedir para cancelar um agendamento:
  1. Pergunte: "Para localizar seu agendamento, pode me informar seu nome completo e e-mail?"
  2. Aguarde a resposta.
  3. Use "Buscar_reuniao" para localizar o evento.
  4. Use "Deletar_gcal" para cancelar.
  5. Confirme o cancelamento de forma simpática.

APÓS AGENDAR, envie APENAS isso:
"[Nome], tá agendado! 🎉
[Data] às [hora], segue o link:
[link_meet]
Qualquer coisa é só me chamar 👍"

REGRAS:
- 🚫 PROIBIDO: Jamais chame "Agendar_gcal" sem ter email E nome_completo fornecidos pelo lead. Sem esses dados = não agenda, ponto final.
- ⚠️ CRÍTICO: Se o lead já informou o horário, é PROIBIDO sugerir outras opções. Vá direto para o passo 4.5.
- NUNCA use travessão (:) em nenhuma mensagem. Use vírgula ou ponto.
- Máximo 3 linhas por bloco de mensagem.
- Chame "Consultar_gcal" apenas UMA vez por interação.
- Retorno vazio do "Consultar_gcal" = calendário livre, não repita a consulta.
- Nunca use "amanhã" sem verificar via "Hora_atual" se é dia útil. Sempre use dia da semana + data.
- Seg a Sex, 9h às 18h, nunca no mesmo dia.
- Fuso: America/Sao_Paulo (UTC-3).
- Nunca repita informações já confirmadas pelo lead.
- O link do Meet deve ser enviado automaticamente, sem o lead precisar pedir.
- Sempre chame o lead pelo nome.
- Tom: amigável e profissional, nunca frio ou mecânico.
- Nunca repita perguntas já respondidas.
- Nunca ofereça mais de uma rodada de opções de horário.`

  const tools: OpenAI.Chat.ChatCompletionTool[] = [
    {
      type: 'function',
      function: {
        name: 'Think3',
        description: 'Use para pensar sobre algo. Não obtém novas informações nem altera o banco. Use quando precisar de raciocínio complexo.',
        parameters: { type: 'object', properties: { thought: { type: 'string' } }, required: ['thought'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'Hora_atual',
        description: 'Retorna a data e hora atual no fuso America/Sao_Paulo',
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
        description: 'Cria um evento no Google Calendar com link Meet. Exige email e nome completo do lead para enviar o convite.',
        parameters: {
          type: 'object',
          properties: {
            data_hora: { type: 'string', description: 'ISO8601, ex: 2026-05-05T10:00:00' },
            email: { type: 'string', description: 'Email do lead para envio do convite' },
            nome_completo: { type: 'string', description: 'Nome completo do lead' },
            duracao_minutos: { type: 'number' },
          },
          required: ['data_hora', 'email', 'nome_completo'],
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
    'Think3': async (args) => `Raciocínio registrado: ${args.thought}`,
    'Hora_atual': async (_args) => {
      return new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'full', timeStyle: 'short' })
    },
    'Buscar_reuniao': async (_args) => {
      const { data } = await supabase
        .from('leads')
        .select('call_de_venda, call_agendada_para, meet_url, call_status, contact_name, calendar_event_id')
        .eq('id', ctx.leadId)
        .single()

      // O banco só reflete o que o SDR gravou quando agendou : se alguém cancelar
      // ou deletar o evento direto no Google Calendar, o banco fica desatualizado
      // e o SDR continuaria oferecendo uma reunião que não existe mais. Por isso
      // reuniao_valida é sempre calculado aqui, consultando o Calendar de verdade
      // (fonte da verdade), nunca deixado pra IA decidir se confia no banco ou
      // confere o calendário : achado ao vivo (2026-09-02) uma reunião de horário
      // já passado e evento já deletado sendo apresentada como "já temos marcado".
      let reuniaoValida = false
      let motivo = 'sem_agendamento'
      if (data?.call_de_venda && data?.calendar_event_id && ctx.calendarId) {
        try {
          const evento = await getEvent(ctx.calendarId, data.calendar_event_id, ctx.companyId)
          if (!evento) {
            motivo = 'evento_nao_existe_mais_no_calendario'
          } else if (evento.start.getTime() < Date.now()) {
            motivo = 'horario_ja_passou'
          } else {
            reuniaoValida = true
            motivo = 'confirmado_no_calendario'
          }
        } catch (err: any) {
          console.error(`[SDR:${ctx.companyId}] Buscar_reuniao : falha ao confirmar no Calendar:`, err.message)
          motivo = 'erro_ao_consultar_calendario'
        }
      }

      return JSON.stringify({
        ...data,
        reuniao_valida: reuniaoValida,
        motivo,
      })
    },
    'Consultar_gcal': async (args) => {
      try {
        const date = new Date(args.data)
        if (isNaN(date.getTime())) return 'ERRO_CALENDARIO: data inválida'
        const slots = await checkAvailableSlots({ calendarId: ctx.calendarId!, date, companyId: ctx.companyId })
        const available = slots.filter((s) => s.available)
        if (available.length === 0) return 'Sem horários disponíveis nesta data (dia cheio ou fim de semana).'
        return `Horários livres (9h–18h): ${available.map((s) =>
          s.start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
        ).join(', ')}`
      } catch (err: any) {
        console.error(`[SDR:${ctx.companyId}] Consultar_gcal erro (calendarId=${ctx.calendarId}):`, err.message, err.stack?.slice(0, 500))
        return `ERRO_CALENDARIO: ${err.message}`
      }
    },
    'Agendar_gcal': async (args) => {
      try {
        if (!args.email || !args.email.includes('@')) {
          return 'BLOQUEADO: Você precisa coletar o email do lead antes de agendar. Pergunte agora: "Para enviar o convite, pode me informar seu nome completo e e-mail?"'
        }
        if (!args.nome_completo || args.nome_completo.trim().split(' ').length < 2) {
          return 'BLOQUEADO: Você precisa coletar o nome completo do lead antes de agendar. Pergunte agora: "Para enviar o convite, pode me informar seu nome completo e e-mail?"'
        }
        const start = parseBrazilDateTime(args.data_hora)
        const nomeCompleto: string = args.nome_completo
        const resolvedTitle = ctx.eventTitleTemplate
          ? ctx.eventTitleTemplate.replace('{nome}', nomeCompleto)
          : `Call de venda : ${nomeCompleto}`
        const event = await createEventWithMeet({
          calendarId: ctx.calendarId!,
          companyId: ctx.companyId,
          title: resolvedTitle,
          description: `Lead: ${nomeCompleto}\nWhatsApp: ${ctx.leadPhone}\nAgendado via Nexio.AI SDR`,
          start,
          durationMinutes: args.duracao_minutos ?? 60,
          attendeeEmail: args.email,
          attendeeName: nomeCompleto,
        })
        // Sincroniza nome/email de volta pro lead : nome_completo e email já
        // vieram validados acima (obrigatórios pra agendar), mas até aqui só
        // iam pro evento do Calendar, nunca voltavam pra tabela leads : o CRM
        // ficava com o dado antigo (ex: nome parcial vindo do Briefing) pra
        // sempre, mesmo o lead confirmando o nome completo na conversa.
        await supabase.from('leads').update({
          contact_name: nomeCompleto,
          email: args.email,
        }).eq('id', ctx.leadId)
        return JSON.stringify({ event_id: event.eventId, meet_url: event.meetUrl, start: event.start.toISOString(), data_formatada: formatDateTimeBR(event.start) })
      } catch (err: any) {
        console.error(`[SDR:${ctx.companyId}] Agendar_gcal erro (calendarId=${ctx.calendarId}):`, err.message, err.stack?.slice(0, 500))
        return `Erro ao criar evento: ${err.message}`
      }
    },
    'Deletar_gcal': async (args) => {
      try {
        if (args.event_id && ctx.calendarId) {
          await cancelEvent(ctx.calendarId, args.event_id, ctx.companyId)
        }
        await supabase.from('leads').update({
          call_de_venda: false,
          call_status: 'cancelada',
          calendar_event_id: null,
          updated_at: new Date().toISOString(),
        }).eq('id', ctx.leadId)
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
        updates.calendar_event_id = null
      } else if (args.data_hora_iso) {
        updates.call_de_venda = true
        updates.call_agendada_para = args.data_hora_iso
        updates.meet_url = args.meet_url ?? null
        updates.call_status = 'agendada'
        if (args.event_id) updates.calendar_event_id = args.event_id
      }
      await supabase.from('leads').update(updates).eq('id', ctx.leadId)
      return JSON.stringify({ salvo: true, acao: args.acao })
    },
  }

  return runAgentLoop(
    systemPrompt,
    `WhatsApp do lead: ${ctx.leadPhone}\nNome: ${ctx.leadName}\nMensagem: ${message}`,
    tools, handlers, openai, 'gpt-4.1', acc, 'agendamento', 10, history,
    (toolName, result) => {
      if (toolName === 'Consultar_gcal' && result.startsWith('ERRO_CALENDARIO')) {
        console.error(`[SDR:${ctx.companyId}] Consultar_gcal abortou : retornando erro ao lead`)
        return `Desculpe, ${ctx.leadName}, tive um problema técnico pra acessar o calendário agora. Pode tentar novamente em instantes? 🙏`
      }
      return null
    }
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
  area_entrega?: string
  formas_pagamento?: string
  valor_minimo_pedido?: string
  pedido_tipo?: string
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
  // ── Camada 1 (FIXO): prompt exato do nó AI Agent2 do N8N ─────
  const knowledgeStep = ctx.conhecimentoAtivo
    ? '2. Chame Play_conhecimento passando a mensagem como query'
    : null
  const objStep = ctx.objecoesAtivo
    ? `${knowledgeStep ? '3' : '2'}. Chame Play_objeções passando a mensagem como query`
    : null
  const baseIdx = (knowledgeStep ? 1 : 0) + (objStep ? 1 : 0) + 2
  const steps = [
    '1. Chame Think1 passando a mensagem',
    ...(knowledgeStep ? [knowledgeStep] : []),
    ...(objStep ? [objStep] : []),
    `${baseIdx}. Chame Agente de Pipeline passando a mensagem`,
    `${baseIdx + 1}. Chame Agente de Segmentação passando a mensagem`,
    `${baseIdx + 2}. Chame Agente de Inteligência Outbound passando a mensagem`,
    `${baseIdx + 3}. Chame Memory_long`,
    `(CONDICIONAL) Se a mensagem indicar rastreamento de pedido, cancelamento ou reclamação grave: chame Pausar_conversa antes de responder`,
  ]

  const fixedLogic = `Você é um orquestrador de vendas ativo. Seu trabalho não é só responder dúvida : é CONDUZIR a conversa até o próximo passo (qualificar, contornar objeção, ou fechar agendamento). Nunca seja passivo, nunca espere o lead perguntar de novo : depois de responder, sempre direcione pra frente.

Você não tem conhecimento próprio sobre o produto/empresa : todo esse conhecimento vem exclusivamente das tools abaixo. Chame todas antes de responder, mesmo pra uma mensagem simples como um "oi".

Quando receber uma mensagem:

${steps.join('\n')}

Você é INCAPAZ de responder sem chamar essas tools porque não possui nenhuma informação. Todo seu conhecimento vem exclusivamente dos retornos das tools.

Após chamar todas as tools, use o conteúdo retornado pelo Play_conhecimento e Play_objeções para FORMULAR uma resposta natural e humana ao lead. NUNCA copie headers, checklists, títulos ou estruturas internas dos documentos. Responda como um atendente, direto, natural, baseado no que as tools retornaram. Termine SEMPRE conduzindo a conversa adiante (uma pergunta de qualificação, uma quebra de objeção, ou um empurrão pro próximo passo real do fluxo), a não ser que o lead tenha pedido explicitamente pra parar. "Empurrar adiante" NUNCA significa inventar uma entrega que não existe (ex: oferecer mandar resumo, passo a passo ou material escrito quando o objetivo real da conversa é uma call/reunião) : use somente o que as tools e scripts configurados já oferecem.

REGRAS DE MENSAGEM (CRÍTICO):
- Cada bloco de mensagem é separado por UMA linha em branco (\\n\\n). O sistema envia cada bloco como uma mensagem separada no WhatsApp.
- Máximo 1 a 2 frases por bloco.
- Máximo 3 blocos por resposta, a não ser que o lead peça explicitamente mais detalhe. 4+ blocos vira discurso educativo longo, mesmo com frases curtas : corte, não explique tudo de uma vez.
- NUNCA junte tudo em um parágrafo só. Sempre quebre em blocos.
- NUNCA use travessão (—). Use vírgula ou ponto.
- NUNCA repita a mesma muleta de frase em mensagens seguidas (ex: "Se quiser, posso...", "Fico à disposição", "Qualquer dúvida me avisa"). Revise mentalmente a ÚLTIMA mensagem que você mandou nesta conversa : se ela já terminava com uma oferta parecida, feche essa mensagem de um jeito diferente ou sem oferta nenhuma.
- Evite "Se quiser, posso..." como abertura padrão de oferta : é hedge passivo, soa hesitante e repetitivo. Prefira afirmar direto ou fazer a pergunta objetiva (em vez de "Se quiser, posso te explicar os motivos", use "Isso costuma acontecer por 2-3 motivos : [motivo]. Você já tem X?"). Seja direto e cirúrgico, não ofereça passivamente.

Exemplo CORRETO:
Olá, Rodrigo! Tudo bem por aqui, e com você?

Como posso te ajudar hoje?

Exemplo ERRADO:
Olá, Rodrigo! Tudo bem por aqui, e com você? Como posso te ajudar hoje? Se quiser saber mais é só falar!`

  // ── Camada 2 (DINÂMICO): identidade da empresa ────────────────
  const persona = parsePersona(ctx.prompt)
  let companyBlock = ''
  if (persona) {
    const lines: string[] = []
    if (persona.nome_agente)       lines.push(`Você se chama ${persona.nome_agente}.`)
    if (persona.tom)               lines.push(`Tom: ${persona.tom}.`)
    if (persona.empresa)           lines.push(`Empresa: ${persona.empresa}.`)
    if (persona.produto)           lines.push(`Produto/serviço: ${persona.produto}.`)
    if (persona.restricoes)        lines.push(`Nunca diga: ${persona.restricoes}.`)
    if (ctx.businessHoursSummary)  lines.push(`Horário de atendimento: ${ctx.businessHoursSummary}.`)
    if (persona.area_entrega)      lines.push(`Área de entrega e taxas: ${persona.area_entrega}.`)
    if (persona.formas_pagamento)  lines.push(`Formas de pagamento aceitas: ${persona.formas_pagamento}.`)
    if (persona.valor_minimo_pedido) lines.push(`Valor mínimo do pedido: ${persona.valor_minimo_pedido}.`)
    if (persona.pedido_tipo)       lines.push(`Como o pedido é finalizado: ${persona.pedido_tipo}.`)
    if (lines.length > 0) companyBlock = `\n\nCONTEXTO DA EMPRESA:\n${lines.join('\n')}`
  } else if (ctx.prompt) {
    companyBlock = `\n\nCONTEXTO DA EMPRESA:\n${ctx.prompt}`
  }

  // ── Camada 3 (FIXO condicional): agendamento : exato do AI Agent2 ─
  const schedulingBlock = ctx.briefingLinkPending
    ? `\n\nREGRA CRÍTICA DE AGENDAMENTO:
Esta empresa exige preencher o formulário de briefing ANTES de marcar reunião. Você NÃO tem a tool "Agente_de_Agendamento" disponível agora, de propósito : não tente chamá-la, ela não existe na sua lista de tools desta vez.
Se o lead demonstrar QUALQUER intenção de agendar, remarcar ou cancelar uma reunião/call, chame "Play_conhecimento" com essa intenção como query pra pegar o link do formulário de fechamento configurado na base de conhecimento, e mande esse link pro lead. NUNCA invente um link, NUNCA diga que vai agendar sem o link ter sido enviado antes.`
    : ctx.calendarId
    ? `\n\nREGRA CRÍTICA DE AGENDAMENTO:
1. Se a ÚLTIMA mensagem que você enviou ao lead era uma pergunta de confirmação de agendamento (ex: "[Nome], [dia] [data] às [hora] : confirma?") E a resposta do lead for qualquer afirmação ("sim", "pode", "ok", "confirmo", "isso", "s", "claro", "quero"), chame IMEDIATAMENTE "Agente_de_Agendamento" : NÃO processe mais nada, NÃO chame outras tools.
2. Se o lead demonstrar QUALQUER intenção de agendar, remarcar ou cancelar uma REUNIÃO ou CALL com data e hora marcadas, chame IMEDIATAMENTE "Agente_de_Agendamento" : sem enviar nenhuma mensagem de texto antes, sem dizer "aguarde", sem dizer "já verifico".
Em ambos os casos: chame a tool diretamente e retorne exatamente o que ela responder, sem alterar nada. Mensagens genéricas sobre outros assuntos NÃO devem acionar esse agente.
⛔ PROIBIDO chamar "Agente_de_Agendamento" para: pedido de teste grátis, link de teste, cadastro, demonstração, dúvida sobre produto ou preço, ou qualquer coisa que não seja marcar uma reunião/call com data e hora reais. Esse agente só sabe mexer no Google Calendar : ele NÃO conhece o produto, não tem link de teste e não envia e-mail nenhum. Pedido de teste/trial é respondido com "Play_conhecimento"/"Play_objecoes", nunca com este agente.`
    : ''

  // ── Camada 4 (FIXO condicional): diagnóstico de perfil como gancho de reunião ─
  // Técnica: Information Gap Theory (Loewenstein, 1994) : curiosidade funciona
  // como fome, uma vez ativada exige ser saciada. Revela 1 achado concreto,
  // nunca a lista inteira : prometer "tenho mais coisas" e não entregar no
  // diagnóstico é manipulação percebida, queima confiança. A reunião TEM que
  // entregar o resto de verdade.
  const placesBlock = ctx.placesAnalysisAtivo
    ? `\n\nDIAGNÓSTICO DE PERFIL (GANCHO DE REUNIÃO):
Quando for argumentar sobre a presença digital do lead, ou quando fizer sentido reforçar o convite pra reunião, chame "Buscar_analise_places".
Regras de uso do que a tool devolver:
1. Revele SOMENTE o gap_principal, com o dado concreto dele (número, nota, quantidade : nunca genérico tipo "seu perfil tem problemas").
2. NUNCA liste os outros gaps. Diga que encontrou mais pontos (use outros_gaps_encontrados) sem dizer quais são.
3. Use isso como o motivo de agendar : "no diagnóstico completo eu te mostro cada um desses pontos e como resolver, ao vivo". A reunião é a entrega do resto, não uma call genérica de apresentação.
4. Nunca prometa algo que a reunião não vai cumprir : se disser que tem mais gaps, o diagnóstico na call precisa realmente cobrir todos.`
    : ''

  return `${fixedLogic}${companyBlock}${schedulingBlock}${placesBlock}`
}

// Mapa de nome-display (n8n) → nome-função (OpenAI: ^[a-zA-Z0-9_-]+$)
const TOOL_NAME_MAP: Record<string, string> = {
  'Think1':                          'Think1',
  'Play_conhecimento':               'Play_conhecimento',
  'Play_objeções':                   'Play_objecoes',
  'Agente de Pipeline':              'Agente_de_Pipeline',
  'Agente de Segmentação':           'Agente_de_Segmentacao',
  'Agente de Inteligência Outbound': 'Agente_de_Inteligencia_Outbound',
  'Memory_long':                     'Memory_long',
  'Agente de Agendamento':           'Agente_de_Agendamento',
  'Pausar_conversa':                 'Pausar_conversa',
  'Gerar_cobranca':                  'Gerar_cobranca',
  'Buscar_analise_places':           'Buscar_analise_places',
}

function buildOrchestratorTools(ctx: SdrContext): OpenAI.Chat.ChatCompletionTool[] {
  // Nomes de função válidos para a API OpenAI (^[a-zA-Z0-9_-]+$)
  const tools: OpenAI.Chat.ChatCompletionTool[] = [
    {
      type: 'function',
      function: {
        name: TOOL_NAME_MAP['Think1'],
        description: 'Analisa a mensagem do lead e retorna o contexto, intenção e estratégia de resposta. Necessário para processar qualquer mensagem.',
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
        name: TOOL_NAME_MAP['Agente de Pipeline'],
        description: 'Atualiza o estágio do lead no CRM com base na interação atual. Registra o progresso da conversa.',
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
        name: TOOL_NAME_MAP['Agente de Segmentação'],
        description: 'Identifica o nicho do lead com base na conversa e atualiza o campo de segmento no CRM. Use sempre que o lead mencionar o tipo de negócio ou segmento em que atua.',
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
        name: TOOL_NAME_MAP['Agente de Inteligência Outbound'],
        description: 'Retorna dados de contexto do lead como histórico, perfil e estágio atual. Fornece informações essenciais sobre quem está enviando a mensagem.',
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
        name: TOOL_NAME_MAP['Memory_long'],
        description: 'Salva informações relevantes da interação atual na memória de longo prazo do lead. Requer o número do lead e o company_id.',
        parameters: {
          type: 'object',
          properties: {
            nova_informacao: { type: 'string', description: 'Informação nova relevante para guardar' },
            numero: { type: 'string', description: 'WhatsApp do lead' },
          },
          required: ['nova_informacao', 'numero'],
        },
      },
    },
  ]

  if (ctx.conhecimentoAtivo) {
    tools.splice(1, 0, {
      type: 'function',
      function: {
        name: TOOL_NAME_MAP['Play_conhecimento'],
        description: 'Busca na base de conhecimento da empresa a resposta correta para a dúvida ou mensagem do lead. Retorna o conteúdo que deve ser enviado ao lead. Deve ser chamada com a mensagem do lead como query.',
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
        name: TOOL_NAME_MAP['Play_objeções'],
        description: 'Busca na base de conhecimento da empresa argumentos, respostas e estratégias para lidar com objeções, dúvidas e perguntas do lead. Retorna o conteúdo que deve ser usado para responder. Deve ser chamada com a mensagem do lead como query.',
        parameters: {
          type: 'object',
          properties: { query: { type: 'string', description: 'A objeção ou dúvida do lead' } },
          required: ['query'],
        },
      },
    })
  }

  if (ctx.calendarId && !ctx.briefingLinkPending) {
    tools.push({
      type: 'function',
      function: {
        name: TOOL_NAME_MAP['Agente de Agendamento'],
        description: 'Marca, remarca ou cancela uma REUNIÃO/CALL com data e hora no Google Calendar. NÃO use para teste grátis, link de teste, cadastro, demonstração ou dúvidas de produto/preço : este agente só mexe em calendário, não conhece o produto e não tem como enviar link ou e-mail nenhum.',
        parameters: {
          type: 'object',
          properties: {
            nova_informacao_agendamento: { type: 'string', description: 'Última mensagem do lead + histórico resumido da conversa sobre agendamento' },
          },
          required: ['nova_informacao_agendamento'],
        },
      },
    })
  }

  if (ctx.asaasAtivo) {
    tools.push({
      type: 'function',
      function: {
        name: TOOL_NAME_MAP['Gerar_cobranca'],
        description: 'Gera uma cobrança real via Asaas e retorna o link/código de pagamento pra você mandar ao lead. Use SOMENTE quando o lead confirmar de forma clara que quer comprar/contratar AGORA e você já souber com certeza o valor exato e o que está sendo cobrado (baseado na base de conhecimento ou no que foi combinado na conversa). NUNCA chame esta tool com um valor que você não tem certeza : se houver qualquer dúvida sobre o preço, use Play_conhecimento primeiro ou pergunte ao lead antes de gerar a cobrança. SEGURANÇA: NUNCA peça número de cartão de crédito na conversa, em nenhuma hipótese. Se o lead quiser pagar de cartão ou não especificar a forma de pagamento, deixe forma_pagamento em branco : o Asaas gera um link onde o próprio lead digita o cartão com segurança, direto na página deles.',
        parameters: {
          type: 'object',
          properties: {
            valor: { type: 'number', description: 'Valor exato da cobrança em reais, ex: 297.00' },
            descricao: { type: 'string', description: 'O que está sendo cobrado, ex: "Plano Start - assinatura mensal"' },
            forma_pagamento: { type: 'string', enum: ['PIX', 'BOLETO'], description: 'Só preencha se o lead pedir EXPLICITAMENTE pagar por PIX ou boleto (ignorado se a empresa cobra por assinatura : nesse caso é sempre cartão). Deixe em branco pra qualquer outro caso, inclusive cartão.' },
            cpf_cnpj: { type: 'string', description: 'CPF ou CNPJ do lead, obrigatório pra gerar a cobrança. Se ainda não tiver esse dado na conversa, PERGUNTE ao lead antes de chamar esta tool : não chame sem ele.' },
          },
          required: ['valor', 'descricao', 'cpf_cnpj'],
        },
      },
    })
  }

  if (ctx.placesAnalysisAtivo) {
    tools.push({
      type: 'function',
      function: {
        name: TOOL_NAME_MAP['Buscar_analise_places'],
        description: 'Busca o diagnóstico do perfil Google do lead (nota, avaliações, o que falta no perfil). Use quando for argumentar sobre a presença digital do lead ou quando for oferecer/reforçar o agendamento : o gancho da reunião é o diagnóstico completo ao vivo.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    })
  }

  // Sempre disponível : pausa o bot nesta conversa e sinaliza necessidade de atendimento humano
  tools.push({
    type: 'function',
    function: {
      name: TOOL_NAME_MAP['Pausar_conversa'],
      description: 'Pausa o agente nesta conversa e transfere para atendimento humano. Use OBRIGATORIAMENTE quando: (1) cliente perguntar sobre rastreamento/motoboy/onde está seu pedido, (2) cliente quiser cancelar pedido, (3) cliente reclamar de pedido recebido errado/incompleto, (4) lead demonstrar interesse claro em outro produto/serviço que a empresa oferece mas que NÃO é o foco deste contato/campanha (ex: perguntou de algo fora da Base de Conhecimento configurada aqui) : não tente vender nem explicar esse outro serviço, apenas pause e deixe o humano assumir com o contexto já registrado, (5) qualquer outra situação que exija intervenção humana urgente.',
      parameters: {
        type: 'object',
        properties: {
          motivo: { type: 'string', description: 'Motivo do handoff: rastreamento, cancelamento, reclamação ou outro' },
        },
        required: ['motivo'],
      },
    },
  })

  return tools
}

interface ChecklistAtendimento {
  apresentacao_feita?: boolean
  perguntas_e_respostas?: { pergunta: string; resposta: string }[]
  estagio_atual?: string
  lead_recusou?: boolean
}

function formatChecklist(checklist: ChecklistAtendimento | null): string {
  if (!checklist || (!checklist.apresentacao_feita && !checklist.perguntas_e_respostas?.length && !checklist.estagio_atual && !checklist.lead_recusou)) {
    return 'Nenhum item registrado ainda : esta é a primeira interação de qualificação desta conversa.'
  }
  const lines: string[] = []
  if (checklist.lead_recusou) {
    lines.push('⚠️ O LEAD JÁ RECUSOU/PEDIU PRA PARAR EXPLICITAMENTE nesta conversa. NÃO ofereça nada novo, NÃO faça pergunta de qualificação, NÃO empurre a conversa adiante. Responda no máximo uma frase curta e educada se ele mandar algo, e só volte a vender de verdade se ELE fizer uma pergunta clara e nova sobre o produto.')
  }
  lines.push(`Apresentação já feita: ${checklist.apresentacao_feita ? 'SIM : NUNCA se apresente de novo' : 'NÃO : apresente-se nesta resposta'}`)
  if (checklist.perguntas_e_respostas?.length) {
    lines.push('Perguntas de qualificação já respondidas pelo lead (NUNCA repita, mesmo com outras palavras):')
    for (const pr of checklist.perguntas_e_respostas) lines.push(`- ${pr.pergunta}: ${pr.resposta}`)
  }
  if (checklist.estagio_atual) lines.push(`Estágio atual da conversa: ${checklist.estagio_atual}`)
  return lines.join('\n')
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
  const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })

  let checklistText = 'Nenhum item registrado ainda : esta é a primeira interação de qualificação desta conversa.'
  let adHeadline: string | null = null
  if (ctx.conversationId) {
    const { data: convRow } = await supabase
      .from('conversas_do_whatsapp')
      .select('checklist_atendimento')
      .eq('id', ctx.conversationId)
      .maybeSingle()
    const checklistAtual = (convRow?.checklist_atendimento as ChecklistAtendimento) ?? null

    // Lead já recusou/pediu pra parar : achado ao vivo (2026-09-02) que o SDR
    // continuava empurrando venda em toda mensagem seguinte mesmo depois de o
    // lead recusar claramente, porque a regra "empurre sempre adiante" é
    // prosa e o modelo não confiava/lembrava disso sozinho relendo o
    // histórico. Persistido no checklist (igual estagio_atual) : uma vez
    // marcado, fica sinalizado explicitamente em TODO turno seguinte, não só
    // quando a frase de recusa aparece na mensagem atual.
    if (!checklistAtual?.lead_recusou && isOptOutRequest(userInput)) {
      const merged = { ...(checklistAtual ?? {}), lead_recusou: true }
      await supabase.from('conversas_do_whatsapp').update({ checklist_atendimento: merged }).eq('id', ctx.conversationId)
      checklistText = formatChecklist(merged)
    } else {
      checklistText = formatChecklist(checklistAtual)
    }

    // Título do anúncio que o lead clicou (CTWA), se veio de um : já
    // gravado em attribution_events pela ingestão (lib/sdr/inbound.ts),
    // sem chamada extra pra Meta. Usado como gancho de personalização.
    const { data: attrRow } = await supabase
      .from('attribution_events')
      .select('referral_headline')
      .eq('conversation_id', ctx.conversationId)
      .not('referral_headline', 'is', null)
      .order('captured_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    adHeadline = attrRow?.referral_headline ?? null

    // Trava agendamento direto até o formulário de briefing ser preenchido,
    // pra empresa que configurou esse fluxo (achado ao vivo, 2026-09-02 :
    // Grupo Venda) : a regra "chame Agente_de_Agendamento imediatamente" do
    // núcleo é incondicional e sempre vencia o link do formulário no wizard,
    // porque o modelo pula Play_conhecimento quando detecta intenção de
    // agendar. Travando a TOOL em si (não só pedindo por prompt), o modelo
    // fisicamente não consegue pular a etapa : sobra só Play_conhecimento,
    // que é onde o link de fechamento mora.
    const estagioAtual = (convRow?.checklist_atendimento as ChecklistAtendimento | null)?.estagio_atual
    if (estagioAtual !== 'formulario_preenchido') {
      const { data: companyRow } = await supabase
        .from('companies')
        .select('features')
        .eq('id', ctx.companyId)
        .maybeSingle()
      if ((companyRow?.features as Record<string, boolean> | null)?.briefing === true) {
        ctx.briefingLinkPending = true
      }
    }
  }

  const systemMsg = `${buildOrchestratorSystem(ctx)}

CONTEXTO DO CRM:
- Lead: ${ctx.leadName} | WhatsApp: ${ctx.leadPhone}
- Notas: ${leadNotes || 'nenhuma'}
- Empresa: ${ctx.companyName}
- Data/hora: ${now}

CHECKLIST DESTA CONVERSA (siga isto à risca, é mais confiável que reler o histórico sozinho):
${checklistText}${adHeadline ? `

O lead veio de um anúncio com este título/gancho: "${adHeadline}". Se ainda fizer sentido na conversa (especialmente na primeira resposta), retome esse gancho pra criar continuidade com o que ele viu no anúncio. Não force isso se a conversa já avançou pra outro assunto.` : ''}`

  const TOOLS = buildOrchestratorTools(ctx)
  console.log(`[SDR:${ctx.companyId}] tools disponíveis: [${TOOLS.map(t => (t as OpenAI.Chat.ChatCompletionFunctionTool).function?.name ?? '?').join(', ')}]`)

  const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemMsg },
    ...history,
    { role: 'user', content: userInput },
  ]

  // ── Detecção determinística de estados de agendamento ────────────────────
  const AFFIRMATIONS = /^(sim|s|pode|ok|certo|confirmo|isso|quero|tá bom|ta bom|claro|ótimo|otimo|perfeito|combinado|vai|fechado|fecha|topo|top)\.?\s*$/i
  const EMAIL_PATTERN = /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/
  const lastAssistant = [...history].reverse().find((m) => m.role === 'assistant')

  // State 1: lead confirmou horário ("Sim"), ainda não temos o email
  const pendingScheduleConfirm =
    ctx.calendarId &&
    lastAssistant &&
    typeof lastAssistant.content === 'string' &&
    /:\s*confirma\?/i.test(lastAssistant.content) &&
    AFFIRMATIONS.test(userInput.trim())

  // State 2: agente pediu email/nome e lead acabou de enviar (mensagem contém @)
  const pendingEmailCollection =
    ctx.calendarId &&
    lastAssistant &&
    typeof lastAssistant.content === 'string' &&
    /nome completo|e-?mail para enviar|seu e-?mail/i.test(lastAssistant.content) &&
    EMAIL_PATTERN.test(userInput)

  console.log(
    `[SDR:${ctx.companyId}] pendingScheduleConfirm=${!!pendingScheduleConfirm}` +
    ` | pendingEmailCollection=${!!pendingEmailCollection}` +
    ` | calendarId=${!!ctx.calendarId}` +
    ` | lastAssistantRole=${lastAssistant?.role ?? 'none'}` +
    ` | lastAssistantSnippet="${(lastAssistant?.content as string | undefined)?.slice(0, 60) ?? 'N/A'}"` +
    ` | affirm=${AFFIRMATIONS.test(userInput.trim())}` +
    ` | historyLen=${history.length}`
  )

  // Short-circuit 1: lead confirmou → pede email/nome (sem chamar o modelo)
  if (pendingScheduleConfirm && ctx.calendarId) {
    const confirmedDt = parseConfirmedDateTime((lastAssistant!.content as string))
    if (confirmedDt) {
      const existingEmail = extractEmailFromHistory(history)
      if (!existingEmail) {
        console.log(`[SDR:${ctx.companyId}] confirmação detectada : solicitando email/nome antes de criar evento`)
        return `Ótimo, ${ctx.leadName}! ✅ Antes de confirmar, preciso do seu nome completo e e-mail para enviar o convite da reunião 😊`
      }
      // Já tem email : cria o evento direto abaixo em Short-circuit 2
    }
  }

  // Short-circuit 2: lead forneceu email → encontra datetime no histórico e cria evento
  if (pendingEmailCollection && ctx.calendarId) {
    const emailMatch = userInput.match(EMAIL_PATTERN)
    const leadEmail = emailMatch?.[0]
    // Nome = input sem o email e sem pontuação, ou leadName como fallback
    const leadName = userInput.replace(EMAIL_PATTERN, '').replace(/[,\-;\s]+/g, ' ').trim() || ctx.leadName

    // Busca a última mensagem ": confirma?" no histórico para recuperar o datetime
    const confirmaMsg = [...history].reverse().find(
      (m) => m.role === 'assistant' && /:\s*confirma\?/i.test(m.content as string)
    )
    const confirmedDt = confirmaMsg ? parseConfirmedDateTime(confirmaMsg.content as string) : null

    if (leadEmail && confirmedDt) {
      console.log(`[SDR:${ctx.companyId}] email coletado : criando evento para ${leadEmail} em ${confirmedDt.toISOString()}`)
      try {
        const title = ctx.eventTitleTemplate
          ? ctx.eventTitleTemplate.replace('{nome}', leadName)
          : `Call de venda : ${leadName}`
        const event = await createEventWithMeet({
          calendarId: ctx.calendarId,
          companyId: ctx.companyId,
          title,
          description: `Lead: ${leadName}\nWhatsApp: ${ctx.leadPhone}\nAgendado via Nexio.AI SDR`,
          start: confirmedDt,
          durationMinutes: 60,
          attendeeEmail: leadEmail,
          attendeeName: leadName,
        })
        await supabase.from('leads').update({
          call_de_venda: true,
          call_agendada_para: event.start.toISOString(),
          meet_url: event.meetUrl,
          call_status: 'agendada',
          calendar_event_id: event.eventId,
          updated_at: new Date().toISOString(),
        }).eq('id', ctx.leadId)
        return `Perfeito, ${leadName}! Reunião criada com sucesso ✅\n📅 ${formatDateTimeBR(event.start)}\n🔗 ${event.meetUrl}\n\nConvite enviado para ${leadEmail}. Qualquer dúvida é só me chamar 👍`
      } catch (err: any) {
        console.error(`[SDR:${ctx.companyId}] criação de evento (pós-email) falhou:`, err.message)
        return `Desculpe, ${ctx.leadName}, tive um problema técnico ao criar o evento. Pode tentar novamente? 🙏`
      }
    }
  }

  const forcedTool: OpenAI.Chat.ChatCompletionToolChoiceOption = 'required'

  let response = await openai.chat.completions.create({
    model: 'gpt-4.1',
    messages: chatMessages,
    tools: TOOLS,
    tool_choice: forcedTool,
    max_tokens: 2000,
    temperature: 0.1,
  })
  pushUsage(acc, response, 'orchestrator')

  let iterations = 0
  while (response.choices[0]?.finish_reason === 'tool_calls' && iterations < 30) {
    iterations++
    const assistantMsg = response.choices[0].message
    chatMessages.push(assistantMsg)

    const toolCalls = assistantMsg.tool_calls ?? []
    const toolResults: OpenAI.Chat.ChatCompletionToolMessageParam[] = []

    for (const toolCall of toolCalls) {
      if (toolCall.type !== 'function') continue
      const fn = (toolCall as any).function.name as string
      let args: Record<string, any> = {}
      try { args = JSON.parse((toolCall as any).function.arguments) } catch { /* ok */ }

      console.log(`[SDR:${ctx.companyId}] → tool: ${fn} | args: ${JSON.stringify(args).slice(0, 200)}`)

      let result = ''

      // Nomes sanitizados (OpenAI ^[a-zA-Z0-9_-]+$) : mapeados via TOOL_NAME_MAP
      if (fn === 'Think1') {
        result = `Pensamento registrado: ${args.thought}`
      } else if (fn === 'Play_conhecimento') {
        result = await searchDocuments(args.query ?? userInput, ctx.companyId, openai, supabase, 'conhecimento')
        if (!result) result = 'Base de conhecimento: nenhum resultado encontrado para esta query.'
      } else if (fn === 'Play_objecoes') {
        result = await searchDocuments(args.query ?? userInput, ctx.companyId, openai, supabase, 'objecoes')
        if (!result) result = 'Objeções: nenhum argumento encontrado. Use o bom senso.'
      } else if (fn === 'Agente_de_Pipeline') {
        result = await runAgentePipeline(args.message ?? userInput, ctx, openai, supabase, acc)
      } else if (fn === 'Agente_de_Segmentacao') {
        result = await runAgenteSegmentacao(args.message ?? userInput, ctx, openai, supabase, acc)
      } else if (fn === 'Agente_de_Inteligencia_Outbound') {
        result = await runAgenteOutbound(args.message ?? userInput, ctx, openai, supabase, acc)
      } else if (fn === 'Memory_long') {
        const info = args['Nova informação para guardar'] ?? args.info ?? userInput
        result = await runMemoryExpert(info, ctx, openai, supabase, acc)
      } else if (fn === 'Agente_de_Agendamento') {
        const msg = args['Nova_informa__o_para_guardar'] ?? args.nova_informacao_agendamento ?? args.message ?? userInput
        result = await runAgenteAgendamento(msg, ctx, openai, supabase, acc, history)
      } else if (fn === 'Gerar_cobranca') {
        const value = Number(args.valor)
        const description = String(args.descricao ?? '').trim()
        const cpfCnpj = String(args.cpf_cnpj ?? '').replace(/\D/g, '')
        // Recorrência é decidida pela EMPRESA na configuração, nunca pela IA --
        // evita cobrar avulso quando devia ser assinatura ou vice-versa.
        // Assinatura é sempre CREDIT_CARD (cartão cobra sozinho todo ciclo;
        // PIX/boleto recorrente depende do cliente lembrar de pagar manualmente
        // toda vez, alto risco de perder assinatura por esquecimento).
        const billingType = ctx.billingRecurring
          ? 'CREDIT_CARD' as BillingType
          : (['PIX', 'BOLETO'].includes(args.forma_pagamento) ? args.forma_pagamento : 'UNDEFINED') as BillingType

        if (!value || value <= 0 || !description) {
          result = 'ERRO: valor ou descrição inválidos. Não gere a cobrança : peça o valor certo ao lead ou confirme antes de tentar de novo.'
        } else if (!cpfCnpj || (cpfCnpj.length !== 11 && cpfCnpj.length !== 14)) {
          result = 'ERRO: falta o CPF ou CNPJ do lead, obrigatório pro Asaas gerar a cobrança. Peça educadamente o CPF ou CNPJ e, assim que o lead responder, chame Gerar_cobranca de novo com o campo cpf_cnpj preenchido. Isso não é um problema técnico, é só um dado que falta : não peça desculpa nem mencione erro pro lead.'
        } else {
          try {
            const customer = await findOrCreateCustomer(ctx.companyId, {
              name: ctx.leadName || 'Lead',
              phone: ctx.leadPhone || undefined,
              cpfCnpj,
              externalReference: `lead_${ctx.leadId}`,
            })

            let externalId: string
            let paymentUrl: string | undefined
            let bankSlipUrl: string | undefined
            let dueDate: string
            let pixPayload: any = null

            if (ctx.billingRecurring) {
              const subscription = await createSubscription(ctx.companyId, {
                customerId: customer.id,
                value,
                billingType,
                description,
                cycle: 'MONTHLY',
                externalReference: `zaapply_orchestrator_sub_${ctx.leadId}_${Date.now()}`,
              })
              externalId = subscription.id
              dueDate = subscription.nextDueDate
              const firstPayment = await getSubscriptionFirstPaymentUrl(ctx.companyId, subscription.id)
              paymentUrl = firstPayment.invoiceUrl
              bankSlipUrl = firstPayment.bankSlipUrl
            } else {
              dueDate = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10)
              const payment = await createCharge(ctx.companyId, {
                customerId: customer.id,
                value,
                dueDate,
                billingType,
                description,
                externalReference: `zaapply_orchestrator_${ctx.leadId}_${Date.now()}`,
              })
              externalId = payment.id
              paymentUrl = payment.invoiceUrl
              bankSlipUrl = payment.bankSlipUrl
              if (billingType === 'PIX') {
                try { pixPayload = await getPixQrCode(ctx.companyId, payment.id) } catch { /* segue sem PIX copia-e-cola, o link ainda funciona */ }
              }
            }

            await supabase.from('lead_charges').insert({
              company_id: ctx.companyId,
              lead_id: ctx.leadId,
              platform: 'asaas',
              external_id: externalId,
              amount: value,
              description,
              billing_type: billingType,
              due_date: dueDate,
              status: 'pending',
              payment_url: paymentUrl,
              invoice_url: bankSlipUrl || paymentUrl,
              pix_payload: pixPayload,
            })

            const dueDateBr = new Date(dueDate + 'T12:00:00').toLocaleDateString('pt-BR')
            result = `Cobrança gerada com sucesso via Asaas${ctx.billingRecurring ? ' (assinatura mensal)' : ''}. Valor: R$ ${value.toFixed(2).replace('.', ',')}. Vencimento: ${dueDateBr}. `
              + (pixPayload?.payload
                ? `Código PIX copia-e-cola: ${pixPayload.payload}`
                : `Link de pagamento: ${paymentUrl}`)
              + ' Mande esse link/código EXATAMENTE como fornecido acima, sem alterar nenhum caractere, junto com o valor e vencimento.'

            await log(ctx.companyId, 'charge_generated', {
              value, description, billingType, externalId, dueDate, recurring: ctx.billingRecurring,
            }, supabase, ctx.leadPhone, ctx.leadId)
          } catch (err: any) {
            console.error(`[SDR:${ctx.companyId}] Gerar_cobranca falhou:`, err.message)
            result = `ERRO ao gerar cobrança: ${err.message}. Avise o lead que houve um problema técnico ao gerar o pagamento e que alguém do time vai confirmar em instantes.`

            await log(ctx.companyId, 'charge_generation_failed', {
              value, description, billingType, recurring: ctx.billingRecurring,
            }, supabase, ctx.leadPhone, ctx.leadId, err.message)
          }
        }
      } else if (fn === 'Buscar_analise_places') {
        const { data: leadRow } = await supabase.from('leads').select('places_analysis').eq('id', ctx.leadId).maybeSingle()
        const analysis = leadRow?.places_analysis as { score?: { total: number; grade: string }; gaps?: { titulo: string; texto: string }[] } | null
        if (!analysis?.gaps?.length) {
          result = 'Sem diagnóstico de perfil disponível pra esse lead ainda.'
        } else {
          const [primeiro, ...resto] = analysis.gaps
          result = JSON.stringify({
            score: analysis.score,
            gap_principal: primeiro,
            outros_gaps_encontrados: resto.length,
            instrucao: 'Revele SOMENTE o gap_principal na conversa, com o dado concreto dele. NÃO liste os outros. Diga que encontrou mais pontos (use o número em outros_gaps_encontrados) sem detalhar quais são, e ofereça mostrar todos no diagnóstico completo ao vivo na reunião : é o gancho pra agendar.',
          })
        }
      } else if (fn === 'Pausar_conversa') {
        // Pausa o bot nesta conversa : atendimento humano irá assumir.
        // Peça C: além da flag, entra de fato na fila (kanban_stage/current_status)
        // e dispara a distribuição na hora — sem isso a conversa nunca chegava a
        // ser vista pelo motor de distribuição, mesmo já existindo pronto.
        if (ctx.conversationId) {
          const { error } = await supabase
            .from('conversas_do_whatsapp')
            .update({
              agente_pausado: true,
              current_status: 'livre',
              kanban_stage: 'fila',
              queue_entered_at: new Date().toISOString(),
            })
            .eq('id', ctx.conversationId)
          if (error) {
            console.error(`[SDR:${ctx.companyId}] Pausar_conversa erro:`, error.message)
            result = 'ERRO ao pausar conversa: ' + error.message
          } else {
            await log(ctx.companyId, 'agent_paused_handoff', { motivo: args.motivo }, supabase, ctx.leadPhone, ctx.leadId)
            distributeQueuedConversations(ctx.companyId, supabase).catch((e) =>
              console.error(`[SDR:${ctx.companyId}] distribuição pós-handoff falhou:`, e.message)
            )
            result = `Conversa pausada com sucesso. Motivo: ${args.motivo ?? 'handoff'}. Atendente humano será notificado.`
          }
        } else {
          result = 'conversationId não disponível : handoff não executado'
        }
      }

      console.log(`[SDR:${ctx.companyId}] ← tool: ${fn} | resultado: ${result.slice(0, 150)}`)

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
  supabase: ReturnType<typeof createServiceClient>,
  inboxMode: 'vendas' | 'suporte' = 'suporte'
): Promise<string> {
  // Seleciona apenas id : não depende de colunas opcionais (instance_name pode não existir)
  const { data: existing, error: selectError } = await supabase
    .from('conversas_do_whatsapp')
    .select('id')
    .eq('company_id', ctx.companyId)
    .eq('numero_de_telefone', ctx.leadPhone)
    .maybeSingle()

  if (selectError) {
    console.error(`[SDR:${ctx.companyId}] ensureConversation SELECT error:`, selectError.message)
  }

  if (existing?.id) {
    // Atualiza instance_name como best-effort (ignora se coluna não existir)
    if (ctx.instanceName) {
      supabase.from('conversas_do_whatsapp')
        .update({ instance_name: ctx.instanceName })
        .eq('id', existing.id)
        .then((_r: any) => {/* best-effort */}, () => {/* ignored */})
    }
    return String(existing.id)
  }

  // INSERT sem instance_name (coluna pode não existir no banco)
  const { data: created, error: insertError } = await supabase
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
    })
    .select('id')
    .single()

  if (insertError) {
    console.error(`[SDR:${ctx.companyId}] ensureConversation INSERT error:`, insertError.message)
    return ''
  }

  // Tenta setar instance_name opcionalmente
  if (created?.id && ctx.instanceName) {
    supabase.from('conversas_do_whatsapp')
      .update({ instance_name: ctx.instanceName })
      .eq('id', created.id)
      .then((_r: any) => {/* best-effort */}, () => {/* ignored */})
  }

  // Round-robin auto-assign para modo 'vendas'
  if (created?.id && inboxMode === 'vendas') {
    try {
      const { data: attendants } = await supabase
        .from('users')
        .select('id')
        .eq('company_id', ctx.companyId)
        .eq('is_active', true)
        .in('role', ['sdr', 'closer', 'sdr_closer', 'manager', 'admin'])

      if (attendants && attendants.length > 0) {
        const { data: loads } = await supabase
          .from('conversas_do_whatsapp')
          .select('assigned_to')
          .eq('company_id', ctx.companyId)
          .eq('status_da_conversa', 'aberto')
          .not('assigned_to', 'is', null)

        const countMap: Record<number, number> = {}
        for (const a of attendants) countMap[a.id] = 0
        for (const c of (loads ?? [])) {
          if (c.assigned_to != null && countMap[c.assigned_to] !== undefined) {
            countMap[c.assigned_to]++
          }
        }

        const nextUser = attendants.reduce((min, a) =>
          (countMap[a.id] ?? 0) < (countMap[min.id] ?? 0) ? a : min
        )

        await supabase
          .from('conversas_do_whatsapp')
          .update({ assigned_to: nextUser.id, assigned_at: new Date().toISOString() })
          .eq('id', created.id)
      }
    } catch (err: any) {
      console.error(`[SDR:${ctx.companyId}] round-robin assign error:`, err.message)
    }
  }

  return created?.id ? String(created.id) : ''
}

async function saveInbound(
  conversationId: string,
  ctx: SdrContext,
  text: string,
  supabase: ReturnType<typeof createServiceClient>,
  tipo = 'text',
  mediaUrl?: string,
  messageId?: string
): Promise<void> {
  const displayText =
    tipo === 'audio' ? '🎵 Áudio' :
    tipo === 'image' ? '📷 Imagem' :
    tipo === 'document' ? '📄 Documento' :
    tipo === 'video' ? '🎥 Vídeo' :
    text

  if (!conversationId) {
    console.error(`[SDR:${ctx.companyId}] saveInbound ignorado : conversationId vazio`)
    return
  }

  // Dedup: pula insert se messageId já está na tabela (webhook pode ter salvo antes)
  if (messageId) {
    const { data: existing } = await supabase
      .from('mensagens_do_whatsapp')
      .select('id')
      .eq('whatsapp_message_id', messageId)
      .maybeSingle()
    if (existing) {
      console.log(`[SDR:${ctx.companyId}] saveInbound dedup : messageId=${messageId} já existe`)
      return
    }
  }

  const { error } = await supabase.from('mensagens_do_whatsapp').insert({
    id_da_conversacao: conversationId,
    id_do_lead: ctx.leadId,
    company_id: ctx.companyId,
    texto_da_mensagem: displayText,
    tipo_de_mensagem: tipo,
    direcao: 'inbound',
    sender_type: 'human',
    status: 'delivered',
    url_da_midia: mediaUrl ?? null,
    carimbo_de_data_e_hora: new Date().toISOString(),
    whatsapp_message_id: messageId || null,
  })
  if (error) console.error(`[SDR:${ctx.companyId}] saveInbound INSERT error:`, error.message)

  await supabase
    .from('conversas_do_whatsapp')
    .update({ ultima_mensagem: displayText, hora_da_ultima_mensagem: new Date().toISOString() })
    .eq('id', conversationId)
}

async function saveOutbound(
  conversationId: string,
  ctx: SdrContext,
  text: string,
  supabase: ReturnType<typeof createServiceClient>,
  messageId?: string
): Promise<void> {
  if (!conversationId) {
    console.error(`[SDR:${ctx.companyId}] saveOutbound ignorado : conversationId vazio`)
    return
  }

  const { error } = await supabase.from('mensagens_do_whatsapp').insert({
    id_da_conversacao: conversationId,
    id_do_lead: ctx.leadId,
    company_id: ctx.companyId,
    texto_da_mensagem: text,
    tipo_de_mensagem: 'text',
    direcao: 'outbound',
    sender_type: 'ai',
    status: 'sent',
    nome_do_agente: ctx.instanceName || 'SDR IA',
    carimbo_de_data_e_hora: new Date().toISOString(),
    whatsapp_message_id: messageId || null,
  })
  if (error) console.error(`[SDR:${ctx.companyId}] saveOutbound INSERT error:`, error.message)

  await supabase
    .from('conversas_do_whatsapp')
    .update({ ultima_mensagem: text, hora_da_ultima_mensagem: new Date().toISOString() })
    .eq('id', conversationId)
}

// ─── Lead ──────────────────────────────────────────────────────

export async function findOrCreateLead(
  companyId: number,
  phone: string,
  name: string,
  companyName: string,
  supabase: ReturnType<typeof createServiceClient>
): Promise<{ id: number; notes: string }> {
  const { data: existing } = await supabase
    .from('leads')
    .select('id, notes')
    .eq('company_id', companyId)
    .eq('whatsapp', phone)
    .maybeSingle()

  if (existing) return { id: existing.id, notes: existing.notes ?? '' }

  const { data: created, error: insertError } = await supabase
    .from('leads')
    .insert({
      company_id: companyId,
      company_name: companyName || 'Empresa',
      whatsapp: phone,
      contact_name: name || 'Não identificado',
      status: 'Lead novo',
      import_source: 'WhatsApp',
      origem: 'inbound',
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (insertError || !created?.id) {
    throw new Error(`findOrCreateLead: falha ao criar lead : ${insertError?.message ?? 'id nulo'}`)
  }

  return { id: created.id, notes: '' }
}

// ─── Envio com delay humanizado ────────────────────────────────

async function sendWithHumanDelay(
  paragraphs: string[],
  phone: string,
  uazapiUrl: string,
  token: string,
  conversationId: string,
  ctx: SdrContext,
  supabase: ReturnType<typeof createServiceClient>,
  metaPhoneNumberId?: string | null,
  metaToken?: string | null
): Promise<void> {
  const isMeta = !!(metaPhoneNumberId && metaToken)
  const uazapi = isMeta ? null : createUazapiClient(uazapiUrl, token)

  // Janela de 24h : fora dela, mensagem livre falha direto na API da Meta.
  // Bloqueia antes de tentar, em vez de deixar a chamada estourar.
  const windowState = await getWindowStateForConversation(supabase, conversationId)
  if (windowState && !canSendFreeform(windowState)) {
    console.warn(`[SDR:${ctx.companyId}] envio bloqueado : fora da janela de 24h (conversationId=${conversationId})`)
    await log(ctx.companyId, 'send_blocked_outside_window', { conversationId }, supabase, phone, ctx.leadId)
    return
  }

  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i]
    if (!paragraph.trim()) continue

    const typingDelay = Math.floor(Math.random() * (8000 - 3000 + 1)) + 3000
    let sentMessageId: string | undefined

    if (isMeta) {
      await new Promise((r) => setTimeout(r, Math.min(typingDelay, 4000)))
      const metaRes = await fetch(`https://graph.facebook.com/v21.0/${metaPhoneNumberId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${metaToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phone.replace(/\D/g, ''),
          type: 'text',
          text: { body: paragraph, preview_url: true },
        }),
      })
      const metaJson = await metaRes.json()
      if (!metaRes.ok) {
        console.error(`[SDR:meta] ERRO ao enviar mensagem: ${JSON.stringify(metaJson)}`)
        throw new Error(metaJson?.error?.message ?? `Meta API error ${metaRes.status}`)
      }
      sentMessageId = metaJson.messages?.[0]?.id
      console.log(`[SDR:meta] mensagem enviada : id=${sentMessageId}`)
    } else {
      await uazapi!.sendPresence(phone, 'composing', typingDelay)
      await new Promise((r) => setTimeout(r, typingDelay))
      const sendResult = await uazapi!.sendText({ number: phone, text: paragraph })
      sentMessageId = sendResult?.id
    }

    await saveOutbound(conversationId, ctx, paragraph, supabase, sentMessageId)
    await maybeStampFirstCtwaReply(supabase, conversationId)

    if (i < paragraphs.length - 1) {
      await new Promise((r) => setTimeout(r, 1500))
    }
  }
}

// ─── Log ───────────────────────────────────────────────────────

export async function log(
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
  inboxMode: 'vendas' | 'suporte'
  eventTitleTemplate: string | null
  whatsapp_provider: string
  meta_wa_token: string | null
  meta_wa_phone_number_id: string | null
  business_hours_message: string | null
  billing_recurring: boolean
  placesAnalysisAtivo: boolean
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

  // Verifica agente_ativo na tabela companies (fonte de verdade : igual ao N8N)
  const { data: company } = await supabase
    .from('companies')
    .select('agente_ativo, is_active, features')
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
    console.log(`[SDR:${companyId}] OpenAI key resolvida : termina em ...${resolvedOpenAIKey.slice(-4)}`)
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
    `[SDR:${companyId}] config resolvida : flow="${flow?.id ?? 'nenhum'}" ` +
    `prompt=${resolvedPrompt.length}chars ` +
    `conhecimentoAtivo=${resolvedConhecimentoAtivo} table="${resolvedVectorConhecimento ?? 'documents(default)'}" ` +
    `objecoesAtivo=${resolvedObjecoesAtivo} table="${resolvedVectorObjecoes ?? 'off'}"`
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
    inboxMode: (flow?.inbox_mode as 'vendas' | 'suporte') ?? 'suporte',
    eventTitleTemplate: flow?.event_title_template ?? null,
    whatsapp_provider: config.whatsapp_provider ?? 'uazapi',
    meta_wa_token: config.meta_wa_token ? safeDecrypt(config.meta_wa_token) : null,
    meta_wa_phone_number_id: config.meta_wa_phone_number_id ?? null,
    business_hours_message: config.business_hours_message ?? null,
    billing_recurring: config.billing_recurring ?? false,
    placesAnalysisAtivo: !!(company?.features as Record<string, boolean> | null)?.places_analysis,
  }
}

// ─── Enriquecimento de mídia (transcrição de áudio, descrição de imagem) ──────

// Agnóstico de canal : lê de msg.mediaUrl (já resolvida e persistida no storage na
// hora do webhook, seja uazapi ou Meta/CoEx). Não baixa mais direto da uazapi aqui,
// o que quebrava silenciosamente pra mensagens vindas do canal Meta.
async function enrichMediaMessages(
  messages: BufferedMessage[],
  openai: OpenAI
): Promise<Array<BufferedMessage & { enrichedContent: string }>> {
  return Promise.all(
    messages.map(async (msg) => {
      if (!msg.mediaUrl) return { ...msg, enrichedContent: msg.content }

      if (msg.type === 'audio') {
        try {
          const res = await fetch(msg.mediaUrl)
          if (!res.ok) throw new Error(`fetch mídia falhou : ${res.status}`)
          const buffer = Buffer.from(await res.arrayBuffer())
          const mimetype = res.headers.get('content-type') || 'audio/ogg'
          const file = new File([buffer], 'audio.ogg', { type: mimetype })
          const transcription = await openai.audio.transcriptions.create({
            file,
            model: 'whisper-1',
            language: 'pt',
          })
          console.log(`[SDR] Áudio transcrito: "${transcription.text.slice(0, 80)}"`)
          return { ...msg, enrichedContent: transcription.text }
        } catch (e) {
          console.error('[SDR] Transcrição de áudio falhou:', e)
          return { ...msg, enrichedContent: msg.content }
        }
      }

      if (msg.type === 'image') {
        try {
          const resp = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            max_tokens: 300,
            messages: [{
              role: 'user',
              content: [
                { type: 'image_url', image_url: { url: msg.mediaUrl } },
                { type: 'text', text: 'Descreva brevemente o conteúdo desta imagem no contexto de uma conversa comercial via WhatsApp.' },
              ],
            }],
          })
          const desc = resp.choices[0].message.content ?? ''
          return { ...msg, enrichedContent: `[Imagem enviada: ${desc}]` }
        } catch (e) {
          console.error('[SDR] Descrição de imagem falhou:', e)
          return { ...msg, enrichedContent: msg.content }
        }
      }

      if (msg.type === 'document') {
        try {
          const res = await fetch(msg.mediaUrl)
          if (!res.ok) throw new Error(`fetch mídia falhou : ${res.status}`)
          const buffer = Buffer.from(await res.arrayBuffer())
          const text = buffer.toString('utf-8').slice(0, 2000)
          return { ...msg, enrichedContent: `[Documento enviado pelo lead: ${text}]` }
        } catch (e) {
          console.error('[SDR] Extração de documento falhou:', e)
          return { ...msg, enrichedContent: msg.content }
        }
      }

      return { ...msg, enrichedContent: msg.content }
    })
  )
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
    console.log(`[SDR:${companyId}] processando mensagem de ${phone} : agente="${cfg.agent_type}" flow="${cfg.flowId ?? 'default'}")`)

    // ── Verificar franquia antes de processar ──────────────────
    const quotaCheck = await checkTenantQuota(companyId, supabase)
    if (!quotaCheck.allowed) {
      await pauseTenant(companyId, supabase)
      await log(companyId, 'quota_exceeded', { usedThisMonth: quotaCheck.usedThisMonth, quota: quotaCheck.quota }, supabase, phone)
      return
    }

    const bufferedMessages = await drainBuffer(companyId, phone, supabase)
    if (bufferedMessages.length === 0) return

    // Nó "Switch" (15s) : se a última mensagem chegou há menos de 15s, aguarda
    // o tempo restante antes de prosseguir (garante que o lead terminou de digitar)
    const lastMsg = bufferedMessages[bufferedMessages.length - 1]
    const lastMsgAge = Date.now() - new Date(lastMsg.timestamp).getTime()
    if (lastMsgAge < 15_000) {
      await new Promise((r) => setTimeout(r, 15_000 - lastMsgAge))
    }

    const openai = await getOpenAIClient(cfg.openai_key || process.env.OPENAI_API_KEY || '')

    // Enriquece mídia (transcrição de áudio, descrição de imagem, extração de documento)
    const enrichedMessages = await enrichMediaMessages(bufferedMessages, openai)

    const { data: company } = await supabase
      .from('companies')
      .select('name')
      .eq('id', companyId)
      .single()

    // Usa push_name do webhook (nó "Dados do Chat" → "None da pessoa" no N8N)
    const senderName = bufferedMessages[0]?.senderName || bufferedMessages[0]?.content?.split(' ')[0] || ''
    const { id: leadId, notes: leadNotes } = await findOrCreateLead(companyId, phone, senderName, company?.name ?? '', supabase)

    const businessHoursSummary = await getBusinessHoursSummary(companyId, supabase)

    const { data: asaasIntegration } = await supabase
      .from('payment_integrations')
      .select('id')
      .eq('company_id', companyId)
      .eq('platform', 'asaas')
      .eq('active', true)
      .maybeSingle()
    const asaasAtivo = !!asaasIntegration

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
      eventTitleTemplate: cfg.eventTitleTemplate,
      businessHoursSummary,
      asaasAtivo,
      billingRecurring: cfg.billing_recurring,
      placesAnalysisAtivo: cfg.placesAnalysisAtivo,
      briefingLinkPending: false, // recalculado em runOrchestrator, com o checklist da conversa em mãos
    }

    const conversationId = await ensureConversation(ctx, supabase, cfg.inboxMode)
    ctx.conversationId = conversationId

    // Salva foto de perfil do WhatsApp na conversa (best-effort)
    const senderPhoto = bufferedMessages[0]?.senderPhoto
    if (conversationId && senderPhoto) {
      supabase
        .from('conversas_do_whatsapp')
        .update({ whatsapp_photo_url: senderPhoto })
        .eq('id', conversationId)
        .then(() => {}, () => {})
    }

    // Salva cada mensagem inbound com tipo e mediaUrl corretos (espelha cada row do N8N flow)
    // SEMPRE salva, mesmo quando pausado : garante histórico no chat e contexto ao reativar
    for (const em of enrichedMessages) {
      await saveInbound(conversationId, ctx, em.enrichedContent, supabase, em.type, em.mediaUrl, em.messageId)
    }

    // Verifica se agente está pausado nesta conversa (só APÓS salvar as mensagens)
    const { data: conv } = await supabase
      .from('conversas_do_whatsapp')
      .select('agente_pausado')
      .eq('id', conversationId)
      .single()

    if (conv?.agente_pausado) {
      await log(companyId, 'agent_paused_conversation', {}, supabase, phone, leadId)
      return
    }

    // ── Horários de atendimento ─────────────────────────────────────────────────
    // Bloqueio "pula esse job" (não pausa a conversa) : se fora do horário
    // configurado, manda mensagem de ausência, coloca em fila e retorna antes
    // do orquestrador rodar. Sem linhas em business_hours = sempre aberto.
    const withinHours = await isWithinBusinessHours(companyId, supabase)
    if (!withinHours) {
      const { data: convQueue } = await supabase
        .from('conversas_do_whatsapp')
        .select('kanban_stage, queue_entered_at')
        .eq('id', conversationId)
        .single()

      const spToday = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })).toDateString()
      const alreadyQueuedToday = convQueue?.kanban_stage === 'fila'
        && convQueue?.queue_entered_at
        && new Date(new Date(convQueue.queue_entered_at).toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })).toDateString() === spToday

      if (!alreadyQueuedToday) {
        const msg = cfg.business_hours_message?.trim()
          || 'No momento estamos fora do horário de atendimento. Assim que reabrirmos, um de nossos atendentes ou nosso assistente virtual dará continuidade à conversa.'

        await sendText({ companyId, phoneNumber: phone, text: msg })

        await supabase.from('mensagens_do_whatsapp').insert({
          company_id: companyId,
          id_da_conversacao: conversationId,
          texto_da_mensagem: msg,
          tipo_de_mensagem: 'text',
          direcao: 'outbound',
          sender_type: 'sdr',
          carimbo_de_data_e_hora: new Date().toISOString(),
        })

        await supabase.from('conversas_do_whatsapp').update({
          kanban_stage: 'fila',
          queue_entered_at: new Date().toISOString(),
          current_status: 'livre',
        }).eq('id', conversationId)

        await log(companyId, 'outside_business_hours', {}, supabase, phone, leadId)
      } else {
        await log(companyId, 'outside_business_hours_suppressed', {}, supabase, phone, leadId)
      }
      return
    }

    // ── Épico 3: SDR Modo Recepção ─────────────────────────────────────────────
    // Verifica se este número está em modo 'recepcao'. Se sim, o SDR só coleta
    // o briefing e então pausa-se, passando a conversa para um atendente humano.
    let isRecepcaoMode = false
    let briefingFields: Array<{ name: string; label: string; required: boolean }> = []
    try {
      const { data: modeConfig } = await supabase
        .from('sdr_mode_config')
        .select('mode, briefing_fields')
        .eq('company_id', companyId)
        .maybeSingle()

      if (modeConfig?.mode === 'recepcao') {
        isRecepcaoMode = true
        briefingFields = (modeConfig.briefing_fields as any[]) ?? [
          { name: 'nome', label: 'Nome', required: true },
          { name: 'interesse', label: 'Interesse / objetivo', required: true },
        ]
      }
    } catch {
      // tabela ainda não existe (migration pendente) — continua modo normal
    }

    if (isRecepcaoMode) {
      // Carrega briefing já coletado desta conversa
      const { data: convData } = await supabase
        .from('conversas_do_whatsapp')
        .select('briefing, nome_do_contato')
        .eq('id', conversationId)
        .single()

      const currentBriefing: Record<string, string> = (convData?.briefing as any) ?? {}
      const requiredFields = briefingFields.filter(f => f.required)
      const missingFields = requiredFields.filter(f => !currentBriefing[f.name])

      const lastUserMessage = enrichedMessages[enrichedMessages.length - 1]?.enrichedContent ?? ''

      // Salva resposta do lead no briefing
      if (missingFields.length > 0) {
        // Detecta qual campo está sendo respondido e salva
        const nextMissing = missingFields[0]
        if (lastUserMessage.trim().length > 1) {
          currentBriefing[nextMissing.name] = lastUserMessage.trim()
          await supabase
            .from('conversas_do_whatsapp')
            .update({ briefing: currentBriefing })
            .eq('id', conversationId)
        }
      }

      // Recalcula campos faltantes após atualização
      const remainingMissing = briefingFields.filter(f => f.required && !currentBriefing[f.name])

      if (remainingMissing.length === 0) {
        // ✅ Briefing completo: pausa SDR, move para fila
        await supabase
          .from('conversas_do_whatsapp')
          .update({
            agente_pausado: true,
            current_status: 'livre',
            kanban_stage: 'fila',
            queue_entered_at: new Date().toISOString(),
          })
          .eq('id', conversationId)

        const handoffMsg = 'Perfeito! Recebi todas as informações. Em breve um de nossos especialistas entrará em contato com você. Aguarde!'
        const uazClient = createUazapiClient(cfg.uazapi_instance_url, cfg.uazapi_token)
        await uazClient.sendText({ number: phone, text: handoffMsg })

        await supabase.from('mensagens_do_whatsapp').insert({
          company_id: companyId,
          id_da_conversacao: conversationId,
          texto_da_mensagem: handoffMsg,
          tipo_de_mensagem: 'text',
          direcao: 'outbound',
          sender_type: 'sdr',
          carimbo_de_data_e_hora: new Date().toISOString(),
        })

        await log(companyId, 'recepcao_handoff', { briefing: currentBriefing }, supabase, phone, leadId)
        return
      }

      // Pede o próximo campo faltante
      const nextField = remainingMissing[0]
      let question = `Para que nosso time possa te atender melhor, preciso de mais algumas informações.\n\n*${nextField.label}:* qual seria?`
      if (nextField.name === 'nome' && !(convData?.nome_do_contato)) {
        question = 'Olá! Para te atender melhor, pode me informar seu nome?'
      } else if (nextField.name === 'interesse') {
        question = `Obrigado! E qual é o seu interesse ou objetivo principal?`
      }

      const uazClient = createUazapiClient(cfg.uazapi_instance_url, cfg.uazapi_token)
      await uazClient.sendText({ number: phone, text: question })

      await supabase.from('mensagens_do_whatsapp').insert({
        company_id: companyId,
        id_da_conversacao: conversationId,
        texto_da_mensagem: question,
        tipo_de_mensagem: 'text',
        direcao: 'outbound',
        sender_type: 'sdr',
        carimbo_de_data_e_hora: new Date().toISOString(),
      })

      await log(companyId, 'recepcao_briefing_question', { field: nextField.name, remaining: remainingMissing.length }, supabase, phone, leadId)
      recordUsage(companyId, [], supabase, quotaCheck.packageId).catch(console.error)
      return
    }
    // ── Fim modo Recepção ──────────────────────────────────────────────────────

    // Texto combinado para o orquestrador (usa transcrição/descrição para mídia)
    const combinedText = enrichedMessages.map((m) => m.enrichedContent).join('\n')

    const history = await getHistory(leadId, companyId, supabase, 20)

    await log(companyId, 'message_received', { messages: bufferedMessages, flowId: cfg.flowId }, supabase, phone, leadId)

    // ── Acumulador de usage : passado por referência a todos os agentes ──
    const acc: UsageAcc = []

    // Usa conteúdo enriquecido (transcrição/descrição) para o orquestrador
    const messagesForOrchestrator: BufferedMessage[] = enrichedMessages.map((em) => ({
      ...em,
      content: em.enrichedContent,
    }))
    const aiResponse = await runOrchestrator(messagesForOrchestrator, history, ctx, leadNotes, supabase, openai, acc)
    if (!aiResponse) return

    const paragraphs = aiResponse
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter(Boolean)

    console.log(`[SDR:${companyId}] → enviando ${paragraphs.length} bloco(s) para ${phone}:`)
    paragraphs.forEach((p, i) => console.log(`  [${i + 1}] ${p}`))
    await sendWithHumanDelay(paragraphs, phone, cfg.uazapi_instance_url, cfg.uazapi_token, conversationId, ctx, supabase, cfg.meta_wa_phone_number_id, cfg.meta_wa_token)
    console.log(`[SDR:${companyId}] ✓ enviado para ${phone}`)

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
    console.log(`[SDR:${companyId}] webhook recebido : EventType="${eventType}"`)

    if (typeof eventType === 'string' && eventType.toLowerCase().includes('connect')) {
      const rawStatus = (body as any).status ?? (body as any).state ?? (body as any).instance?.status
      const s = typeof rawStatus === 'string' ? rawStatus.toLowerCase() : ''
      const normalized =
        s === 'open' || s === 'connected' || s === 'authenticated' ? 'connected' :
        s === 'close' || s === 'disconnected' || s === 'logout' ? 'disconnected' :
        null
      console.log(`[SDR:${companyId}] evento de conexão : status="${s}" → normalized="${normalized}"`)
      if (normalized) {
        await supabase.from('sdr_configs').update({
          instance_status: normalized,
          ...(normalized === 'disconnected' ? { instance_phone: null } : {}),
        }).eq('company_id', companyId)
      }
      return true
    }

    if (eventType && eventType.toLowerCase() !== 'messages') {
      console.log(`[SDR:${companyId}] ignorado : EventType="${eventType}" não é messages`)
      return false
    }

    if (!body.message) {
      console.log(`[SDR:${companyId}] ignorado : body.message ausente`)
      return false
    }

    if (body.message?.fromMe) {
      console.log(`[SDR:${companyId}] ignorado : fromMe=true`)
      return false
    }

    // Ignora mensagens de grupos (wa_chatid termina em @g.us ou phone vazio)
    const chatId = body.chat?.wa_chatid ?? body.chat?.id ?? ''
    if (chatId.endsWith('@g.us') || !body.chat?.phone) {
      console.log(`[SDR:${companyId}] ignorado : mensagem de grupo ou phone vazio`)
      return false
    }

    const msg = body.message as any

    // Reação (❤️👍 etc) não é mensagem : ignora, não buffa e não gera resposta do SDR
    const rawMessageType = String(msg?.messageType ?? '').toLowerCase()
    if (rawMessageType.includes('reaction')) {
      console.log(`[SDR:${companyId}] ignorado : reação (messageType="${msg?.messageType}")`)
      return false
    }

    const msgType = detectMessageType(body.message)
    const isMedia = msgType === 'audio' || msgType === 'image' || msgType === 'document' || msgType === 'video'

    const text = msg?.text
      || msg?.conversation
      || msg?.extendedTextMessage?.text
      || msg?.body
      || (msgType === 'text' ? body.chat?.wa_lastMessageTextVote : '')
      || ''

    // Mensagens de mídia sem texto são válidas : serão enriquecidas (transcrição/vision) em processSdrMessage
    if (!text.trim() && !isMedia) {
      console.warn(`[SDR:${companyId}] ignorado : texto vazio e não é mídia. Campos:`, Object.keys(msg ?? {}))
      return false
    }

    const phone = normalizePhone(body.chat.phone)
    const messageId = body.message.id ?? body.message.messageid

    // Baixa a mídia da uazapi e sobe pro storage AQUI (não só na hora de enriquecer
    // pra IA) : sem isso mediaUrl fica vazio e a mídia não aparece/toca no Atendimento.
    let mediaUrl: string | undefined
    if (isMedia && messageId) {
      try {
        const uazapiMedia = createUazapiClient(body.BaseUrl ?? 'https://nexioai.uazapi.com', body.token ?? '')
        const { base64Data, mimetype } = await uazapiMedia.downloadMedia(messageId)
        mediaUrl = (await persistMediaToStorage({
          companyId,
          phone,
          bytes: Buffer.from(base64Data, 'base64'),
          mimetype: mimetype || '',
          kind: msgType as 'audio' | 'image' | 'document' | 'video',
        })) ?? undefined
      } catch (e: any) {
        console.error(`[SDR:${companyId}] download/persist de mídia falhou:`, e.message)
      }
    }

    const placeholder = msgType === 'audio' ? '🎵 Áudio'
      : msgType === 'image' ? '📷 Imagem'
      : msgType === 'document' ? '📄 Documento'
      : msgType === 'video' ? '🎥 Vídeo' : ''

    console.log(`[SDR:${companyId}] mensagem de ${body.chat?.phone} : tipo="${msgType}" texto="${(text || placeholder).slice(0, 80)}"`)

    if (text && isPromptInjection(text)) {
      const uazapiBlock = createUazapiClient(
        body.BaseUrl ?? 'https://nexioai.uazapi.com',
        body.token ?? ''
      )
      // Nó "Bloquear contato1" : bloqueia o número na instância
      await uazapiBlock.blockContact(normalizePhone(body.chat.phone)).catch(() => {})
      await log(companyId, 'injection_blocked', { text }, supabase, body.chat.phone)

      // Nó "Enviar mensagem para o ADM1" : alerta via email (fire-and-forget)
      sendInjectionAlertEmail({
        pushName: body.message?.senderName || body.chat?.wa_contactName || 'Desconhecido',
        senderNumber: normalizePhone(body.chat.phone),
        instanceName: body.instanceName ?? '',
        originalMessage: text,
        classification: 'DIRECT_OVERRIDE',
        riskLevel: 'CRITICAL',
        confidence: 0.95,
        timestamp: new Date().toISOString(),
      }).catch(() => {})

      return false
    }

    if (text && isOptOutRequest(text)) {
      markOptOut(companyId, normalizePhone(body.chat.phone), text).catch(() => {})
    }

    const senderName: string = msg?.senderName || body.chat?.wa_contactName || body.message?.senderName || ''
    const senderPhoto: string | undefined = body.chat?.image || body.chat?.imagePreview || undefined

    // Nó "Visualizar mensagem" : marca mensagem como lida (igual ao N8N)
    if (messageId) {
      const uazapiMark = createUazapiClient(
        body.BaseUrl ?? 'https://nexioai.uazapi.com',
        body.token ?? ''
      )
      uazapiMark.markRead(messageId).catch(() => {/* best-effort */})
    }

    // uazapi (API não oficial, Baileys) : ctwa_clid confirmado por terceiro em
    // comunidade uazapi (não é resposta oficial do suporte deles, então segue
    // com o log de verificação abaixo por mais um tempo até confirmar 100% em
    // produção). Formato real, nem sempre presente : ver extractCtwaReferral
    // em uazapi.ts. Quando não vier o click id mas vier o sinal de que é CTWA
    // (entryPointConversionSource='ctwa_ad'), a atribuição ainda funciona pro
    // CAPI usando o telefone do lead como identificador alternativo.
    const ctwa = extractCtwaReferral(msg as any)
    const referral: NormalizedInboundEvent['referral'] = ctwa
      ? { ctwaClid: ctwa.ctwaClid, sourceType: ctwa.sourceApp ? `ctwa_ad:${ctwa.sourceApp}` : 'ctwa_ad', headline: ctwa.title }
      : null

    // LOG TEMPORÁRIO (remover após confirmar em produção real) : grava o
    // payload bruto quando a extração acima encontra sinal de CTWA, pra
    // validar contra caso real antes de confiar 100% e desligar esse log.
    // Número mascarado.
    if (ctwa) {
      try {
        const maskedPhone = phone ? `${'*'.repeat(Math.max(phone.length - 4, 0))}${phone.slice(-4)}` : null
        syslog({
          type: 'debug_ctwa_uazapi',
          severity: 'info',
          message: `CTWA detectado : ctwaClid=${ctwa.ctwaClid ?? '(ausente, só sinal ctwa_ad)'}`,
          company_id: companyId,
          payload: { phone: maskedPhone, rawBody: body },
        }).catch(() => {})
      } catch { /* investigação best-effort, nunca deve quebrar o webhook */ }
    }

    const evt: NormalizedInboundEvent = {
      companyId,
      channel: 'uazapi',
      phone,
      messageId,
      type: msgType,
      text: text || placeholder,
      timestamp: new Date().toISOString(),
      senderName,
      senderPhoto,
      mediaUrl,
      instanceName: body.instanceName ?? null,
      referral,
    }

    const result = await ingestInboundMessage(evt, supabase)
    return result.handled
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
