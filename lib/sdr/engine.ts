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
import { getRedis } from '@/lib/sdr/redis'
import { decrypt } from '@/lib/crypto'
import { getPlatformConfig } from '@/lib/platform-config'
import { runTrialSaasImmediate } from '@/lib/sdr/follow'
import { createUazapiClient, normalizePhone, detectMessageType, sendRichStep, type UazapiWebhookMessage } from './uazapi'
import {
  checkAvailableSlots,
  createEventWithMeet,
  cancelEvent,
  formatDateTimeBR,
  nextBusinessDay,
  isBusinessDay,
  parseBrazilDateTime,
} from '@/lib/google-calendar'
import type OpenAI from 'openai'  // type-only: apagado em compile-time, sem impacto no bundle

// Cache de clientes OpenAI por chave — evita criar nova instância (e conexões HTTP) a cada mensagem
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
import { writeSystemLog } from '@/lib/system-log'
import { gtproCreateLead } from '@/lib/meta/gtpro'

// ─── Tipos ───────────────────────────────────────────────────

interface MetaReferral {
  sourceId?: string
  headline?: string
  ctwaClid?: string
  sourceUrl?: string
}

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
  productsBlock: string | null
}

interface BufferedMessage {
  content: string
  type: string
  timestamp: string
  messageId: string
  mediaUrl?: string
  senderName?: string
  senderPhoto?: string
  replyToText?: string
  replyToSender?: string
  replyToQuotedId?: string
  referral?: MetaReferral
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

// ─── Prompt Injection Security v2.1 (porta completa do N8N) ─────────────────

const INJECTION_CONFIG = {
  HIGH_ENTROPY_THRESHOLD: 4.5,
  CRITICAL_CONFIDENCE: 0.9,
  BLOCK_CONFIDENCE: 0.75,
  SUSPICIOUS_CONFIDENCE: 0.4,
}

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
  // Role Change - Portuguese (padrão genérico "você é uma X" removido — falso positivo em conversa normal)
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

interface InjectionResult {
  isInjection: boolean
  confidence: number
  classification: 'SAFE' | 'SUSPICIOUS_CONTENT' | 'HIGH_RISK_INJECTION' | 'CRITICAL_INJECTION'
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  shouldBlock: boolean
  evidence?: string
  attackVector: string
  detectedKeywords: string[]
  structuralFlags: string[]
}

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

function analyzeInjection(text: string): InjectionResult {
  const safe: InjectionResult = {
    isInjection: false, confidence: 0, classification: 'SAFE', riskLevel: 'LOW',
    shouldBlock: false, attackVector: 'NONE', detectedKeywords: [], structuralFlags: [],
  }
  if (!text) return safe

  // LAYER 1: critical patterns — bloqueio imediato, confiança 0.95
  for (const p of CRITICAL_PATTERNS) {
    const match = p.exec(text)
    if (match) return {
      isInjection: true, confidence: 0.95, classification: 'CRITICAL_INJECTION',
      riskLevel: 'CRITICAL', shouldBlock: true, evidence: match[0],
      attackVector: 'SYNTAX', detectedKeywords: [], structuralFlags: [],
    }
  }

  // LAYER 2: keyword scoring
  const lower = text.toLowerCase()
  let keywordScore = 0
  const detectedKeywords: string[] = []
  for (const kw of HIGH_RISK_KEYWORDS) {
    if (lower.includes(kw.toLowerCase())) { keywordScore += 0.3; detectedKeywords.push(kw) }
  }

  // LAYER 3: structural scoring
  let structuralScore = 0
  const structuralFlags: string[] = []
  if (text.length > 4000) { structuralScore += 0.3; structuralFlags.push('EXCESSIVE_LENGTH') }
  const specialRatio = (text.match(/[^a-zA-Z0-9\sÀ-ÿ]/g) ?? []).length / text.length
  if (specialRatio > 0.4) { structuralScore += 0.3; structuralFlags.push('HIGH_SPECIAL_CHARS') }
  if ((text.match(/[{}]/g) ?? []).length > 10) { structuralScore += 0.3; structuralFlags.push('EXCESSIVE_BRACES') }
  if ((text.match(/[<>]/g) ?? []).length > 6) { structuralScore += 0.2; structuralFlags.push('EXCESSIVE_BRACKETS') }
  if ((text.match(/[|&;`$]/g) ?? []).length > 3) { structuralScore += 0.4; structuralFlags.push('COMMAND_CHARS') }

  // LAYER 4: entropy scoring
  const entropy = calcEntropy(text)
  const entropyScore = entropy > INJECTION_CONFIG.HIGH_ENTROPY_THRESHOLD
    ? Math.min((entropy - INJECTION_CONFIG.HIGH_ENTROPY_THRESHOLD) * 0.2, 0.4)
    : 0
  if (entropyScore > 0) structuralFlags.push('HIGH_ENTROPY')

  // LAYER 5: suspicious patterns
  let suspiciousScore = 0
  for (const p of SUSPICIOUS_PATTERNS) {
    if (p.test(text)) suspiciousScore += 0.2
  }

  // LAYER 6: context (hidden chars + scripts misturados + padrões repetitivos)
  let contextScore = 0
  if (/[​-‏⁠﻿]/.test(text)) { contextScore += 0.4; structuralFlags.push('HIDDEN_CHARACTERS') }
  if (/[一-鿿]/.test(text) && /[a-zA-Z]/.test(text)) { contextScore += 0.2; structuralFlags.push('MULTIPLE_SCRIPTS') }
  const charFreq: Record<string, number> = {}
  for (const c of text) charFreq[c] = (charFreq[c] ?? 0) + 1
  const maxFreq = Math.max(...Object.values(charFreq))
  if (maxFreq > text.length * 0.3) { contextScore += 0.3; structuralFlags.push('REPETITIVE_PATTERNS') }

  const total = Math.min(keywordScore + structuralScore + entropyScore + suspiciousScore + contextScore, 0.98)

  let classification: InjectionResult['classification'] = 'SAFE'
  let riskLevel: InjectionResult['riskLevel'] = 'LOW'
  if (total >= INJECTION_CONFIG.CRITICAL_CONFIDENCE) { classification = 'CRITICAL_INJECTION'; riskLevel = 'CRITICAL' }
  else if (total >= INJECTION_CONFIG.BLOCK_CONFIDENCE) { classification = 'HIGH_RISK_INJECTION'; riskLevel = 'HIGH' }
  else if (total >= INJECTION_CONFIG.SUSPICIOUS_CONFIDENCE) { classification = 'SUSPICIOUS_CONTENT'; riskLevel = 'MEDIUM' }

  let attackVector = 'BEHAVIORAL_PATTERN'
  if (keywordScore > structuralScore && keywordScore > entropyScore) attackVector = 'SEMANTIC_MANIPULATION'
  else if (structuralScore > keywordScore && structuralScore > entropyScore) attackVector = 'STRUCTURAL_EXPLOITATION'
  else if (entropyScore > 0.2) attackVector = 'OBFUSCATION_ATTACK'

  return {
    isInjection: total >= INJECTION_CONFIG.SUSPICIOUS_CONFIDENCE,
    confidence: total,
    classification,
    riskLevel,
    shouldBlock: total >= INJECTION_CONFIG.BLOCK_CONFIDENCE,
    attackVector,
    detectedKeywords,
    structuralFlags,
  }
}

// ─── Buffer (Redis) ────────────────────────────────────────────
// Replica o fluxo N8N: RPUSH na lista, lock via SET NX para garantir
// que apenas um handler aguarda os 30s de batching por lead.

function redisKeys(companyId: number, phone: string) {
  const base = `sdr:${companyId}:${phone}`
  return { buf: `${base}:buf`, lock: `${base}:lock` }
}

async function bufferMessage(companyId: number, phone: string, message: BufferedMessage): Promise<void> {
  const redis = getRedis()
  const { buf } = redisKeys(companyId, phone)
  try {
    const len = await redis.rpush(buf, JSON.stringify(message))
    await redis.expire(buf, 120)
    console.log(`[SDR:${companyId}] bufferMessage OK — key=${buf} len=${len}`)
  } catch (e: any) {
    console.error(`[SDR:${companyId}] bufferMessage FALHOU — Redis indisponível? err=${e?.message}`)
    throw e
  }
}

async function drainBuffer(companyId: number, phone: string): Promise<BufferedMessage[]> {
  const redis = getRedis()
  const { buf } = redisKeys(companyId, phone)
  try {
    const items = await redis.lrange(buf, 0, -1)
    console.log(`[SDR:${companyId}] drainBuffer — key=${buf} items=${items.length}`)
    if (items.length > 0) await redis.del(buf)
    return items.map((s: string) => {
      try { return JSON.parse(s) as BufferedMessage } catch { return null }
    }).filter(Boolean) as BufferedMessage[]
  } catch (e: any) {
    console.error(`[SDR:${companyId}] drainBuffer FALHOU — err=${e?.message}`)
    return []
  }
}

async function isDuplicateMessage(companyId: number, phone: string, messageId: string): Promise<boolean> {
  const redis = getRedis()
  const { buf } = redisKeys(companyId, phone)
  const items = await redis.lrange(buf, 0, -1)
  return items.some((s: string) => {
    try { return (JSON.parse(s) as BufferedMessage).messageId === messageId } catch { return false }
  })
}

// ─── RAG — Busca vetorial no Supabase ─────────────────────────

async function searchDocuments(
  query: string,
  companyId: number,
  openai: OpenAI,
  supabase: ReturnType<typeof createServiceClient>,
  vectorTable?: string | null
): Promise<string> {
  const table = vectorTable ?? 'documents'
  console.log(`[SDR:${companyId}] RAG search — table="${table}" query="${query.slice(0, 60)}"`)
  try {
    const embRes = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
    })
    const embedding = embRes.data[0].embedding

    const { data, error } = await supabase.rpc('match_documents', {
      query_embedding: embedding,
      match_count: 4,
      filter: { company_id: companyId },
    })

    if (error) {
      console.error(`[SDR:${companyId}] RAG error:`, error.message)
      return ''
    }
    console.log(`[SDR:${companyId}] RAG results: ${data?.length ?? 0} docs`)
    if (!data || data.length === 0) return ''
    return (data as Array<{ content: string }>).map((d) => d.content).join('\n\n')
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
    .select('texto_da_mensagem, sender_type, tipo_de_mensagem, url_da_midia')
    .eq('id_do_lead', leadId)
    .eq('company_id', companyId)
    .order('carimbo_de_data_e_hora', { ascending: false })
    .limit(limit)

  if (!data) return []
  return data
    .reverse()
    .filter((m) => m.texto_da_mensagem)
    .map((m) => {
      let content = m.texto_da_mensagem ?? ''
      // Para menu/button, anexa as opções no histórico para o SDR ter contexto completo
      if ((m.tipo_de_mensagem === 'menu' || m.tipo_de_mensagem === 'button') && m.url_da_midia) {
        try {
          const parsed = JSON.parse(m.url_da_midia)
          const choices: string[] = parsed.choices ?? []
          if (choices.length) content += '\n[Opções enviadas: ' + choices.join(' / ') + ']'
        } catch {}
      }
      return {
        role: (m.sender_type === 'ai' ? 'assistant' : 'user') as 'user' | 'assistant',
        content,
      }
    })
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

/** Extrai datetime confirmado de mensagens como "quinta-feira, 08/05 às 9h — confirma?" */
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

PASSO 1 — USE AGORA a tool "Buscar_origem_lead_no_supabase" passando whatsapp e company_id:
- Se status = "Outbound" → lead veio de abordagem ativa, vá para PASSO 2
- Se diferente → lead inbound, vá direto para o RETORNO FINAL com origem = "inbound"
- Verifique a coluna "briefing_preenchido":
  - true → lead já preencheu o briefing
  - false → briefing ainda não preenchido

PASSO 2 — USE AGORA a tool "Buscar_mensagem_enviada_outbound" passando lead_id e company_id:
- Retorna a mensagem que foi enviada ao lead
- OBRIGATÓRIO se lead for outbound

PASSO 3 — USE AGORA a tool "Salvar_resposta_e_score_do_lead" passando lead_id e company_id com:
- respondeu: true
- respondeu_em: data/hora atual
- mensagem_recebida: mensagem que o lead enviou
- score_interesse: analise o tom e atribua de 1 a 10:
  - 1-3: desinteressado, pediu para parar, ignorou
  - 4-6: neutro, perguntou algo básico
  - 7-9: demonstrou interesse, fez perguntas relevantes
  - 10: pediu proposta, quer agendar

VALIDAÇÃO — Antes de retornar confirme:
✅ Usei "Buscar_origem_lead_no_supabase"? Se não → use agora
✅ Se outbound, usei "Buscar_mensagem_enviada_outbound"? Se não → use agora
✅ Usei "Salvar_resposta_e_score_do_lead"? Se não → use agora

RETORNO FINAL — somente após usar todas as tools:
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

REGRAS DO RESUMO (resumo_ia):
- Máximo 200 palavras
- Use bullet points
- Inclua: interesse demonstrado, objeções, próximos passos, informações relevantes
- Priorize informações novas sobre antigas
- Seja direto — o SDR precisa entender em 30 segundos

NÍVEL DE INTERESSE (use exatamente assim):
- "Quente 🔥"
- "Morno 🌡️"
- "Frio ❄️"

PRIORIDADE (use exatamente assim):
- "Alta"
- "Média"
- "Baixa"

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
    tools, handlers, openai, 'gpt-4.1', acc, 'memory'
  )
}

/** Agente de Agendamento — Google Calendar + Meet */
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

  const nomeEmpresa = ctx.persona?.nome_empresa ?? ctx.prompt?.slice(0, 40) ?? 'nossa empresa'
  const systemPrompt = `Você é um assistente de agendamento comercial de ${nomeEmpresa}. Seu jeito é caloroso, gentil e eficiente. Trate o lead pelo nome sempre que possível e demonstre genuíno entusiasmo em agendar a call.
Data e hora atual: ${now}
Nome do lead: ${ctx.leadName || 'Lead'}
Objetivo da call: Demonstração de ${nomeEmpresa}

FLUXO DE AGENDAMENTO:
0. VERIFIQUE O HISTÓRICO ANTES DE QUALQUER AÇÃO:
   - O input pode conter histórico da conversa. Leia tudo antes de agir.
   - Se no histórico existe uma mensagem sua no formato "[Nome], [dia] [data] às [hora], confirma?" E a última mensagem do lead foi "sim", "pode", "ok", "confirmo", "tá bom" ou qualquer afirmação → PARE. Verifique se já tem nome completo E email no histórico. Se sim: vá direto para "Agendar_gcal". Se não: vá para o passo 4.5 agora.
   - Só inicie o fluxo do passo 1 se não houver confirmação pendente no histórico.
1. "Hora_atual" → obter data/hora exata
2. "Buscar_reuniao" → retorna o campo call_de_venda (boolean)
   - FALSE = sem call marcada → vá direto para o passo 4
   - TRUE = pode ter call marcada → vá para o passo 3
3. "Consultar_gcal" → verificar se o evento realmente existe no calendário
   - Se existir → informe de forma simpática e pergunte se quer reagendar
   - Se não existir → trate como sem agendamento e vá para o passo 4
4. "Consultar_gcal" → verificar conflitos no calendário
   - Se o lead JÁ informou dia e/ou horário desejado:
     → Consulte especificamente esse dia/horário
     → Se livre → vá direto para o passo 4.5
     → Se ocupado → informe e peça outro horário
   - Se o lead NÃO informou horário:
     → Consulte os próximos 3 dias úteis
     → Retorno vazio = dia livre, todos os horários entre 9h e 18h disponíveis
     → Retorno com eventos = considere apenas horários não conflitantes
     → Sugira 3 opções em UMA única mensagem animada e aguarde a escolha
4.5. COLETA DE EMAIL — ÚNICO DADO NECESSÁRIO:
   - O nome do lead já está no contexto (use o campo "Nome do lead" acima).
   - O objetivo da call já está no contexto (use o campo "Objetivo da call" acima).
   - Você SÓ precisa do email do lead para enviar o convite do Google Calendar.
   - Verifique o histórico: o lead já forneceu o email explicitamente?
     → Se SIM: prossiga para o passo 5.
     → Se NÃO: pergunte APENAS: "Para enviar o convite, pode me passar seu e-mail? 😊"
   - PARE e aguarde a resposta. NÃO avance sem o email.
   - ⚠️ PENALIDADE: Chamar "Agendar_gcal" sem email é uma falha crítica. Nunca faça isso.
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
- 🚫 PROIBIDO: Jamais chame "Agendar_gcal" sem ter o email do lead. O nome e objetivo já estão no contexto — não pergunte sobre eles.
- ⚠️ CRÍTICO: Se o lead já informou o horário, é PROIBIDO sugerir outras opções. Vá direto para o passo 4.5.
- 🚫 PROIBIDO: NUNCA ofereça horários para hoje (mesmo dia que aparece em "Data e hora atual" acima). Comece sempre pelo PRÓXIMO dia útil.
- 🚫 PROIBIDO: NUNCA sugira horários que já passaram. O "Consultar_gcal" pode devolver slots de hoje — ignore qualquer slot com hora anterior à hora atual.
- 🚫 PROIBIDO: Não invente disponibilidade. Sempre chame "Consultar_gcal" antes de sugerir horários.
- NUNCA use travessão (—) em nenhuma mensagem. Use vírgula ou ponto.
- Máximo 3 linhas por bloco de mensagem.
- Chame "Consultar_gcal" apenas UMA vez por interação.
- Retorno vazio do "Consultar_gcal" = calendário livre ou todos os slots passaram, vá para o próximo dia útil.
- Nunca use "amanhã" sem verificar via "Hora_atual" se é dia útil. Sempre use dia da semana + data.
- Seg a Sex, 9h às 18h. Nunca agende para o mesmo dia da conversa.
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
            data_hora_iso: { type: 'string', description: 'Data e hora no fuso Brasília, formato YYYY-MM-DDTHH:MM:SS sem sufixo de timezone (ex: 2026-05-28T14:00:00)' },
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
      return JSON.stringify(data ?? {})
    },
    'Consultar_gcal': async (args) => {
      try {
        const date = new Date(args.data)
        if (isNaN(date.getTime())) return 'ERRO_CALENDARIO: data inválida'
        const slots = await checkAvailableSlots({ calendarId: ctx.calendarId!, date, companyId: ctx.companyId })
        // Filtra slots disponíveis E que ainda não passaram (previne sugestão de horários no passado)
        const nowTs = Date.now()
        const available = slots.filter((s) => s.available && s.start.getTime() > nowTs)
        if (available.length === 0) return 'Sem horários disponíveis nesta data (dia cheio, fim de semana ou todos os horários já passaram).'
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
        // Cancela evento anterior se existir (reagendamento sem duplicata)
        if (ctx.calendarId) {
          const { data: leadData } = await supabase
            .from('leads')
            .select('calendar_event_id')
            .eq('id', ctx.leadId)
            .single()
          if (leadData?.calendar_event_id) {
            try { await cancelEvent(ctx.calendarId, leadData.calendar_event_id, ctx.companyId) } catch {}
          }
        }

        const start = parseBrazilDateTime(args.data_hora)
        const nomeCompleto: string = args.nome_completo
        const resolvedTitle = ctx.eventTitleTemplate
          ? ctx.eventTitleTemplate.replace('{nome}', nomeCompleto)
          : `Call de venda — ${nomeCompleto}`
        const event = await createEventWithMeet({
          calendarId: ctx.calendarId!,
          companyId: ctx.companyId,
          title: resolvedTitle,
          description: `Lead: ${nomeCompleto}\nWhatsApp: ${ctx.leadPhone}\nAgendado via Nexio.AI SDR`,
          start,
          durationMinutes: args.duracao_minutos ?? 30,
          attendeeEmail: args.email,
          attendeeName: nomeCompleto,
        })
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
        // Normaliza para UTC — GPT frequentemente passa horário BRT com Z (ex: "14:00Z" = 11:00 BRT)
        updates.call_agendada_para = parseBrazilDateTime(args.data_hora_iso.replace(/Z$/, '')).toISOString()
        updates.meet_url = args.meet_url ?? null
        updates.call_status = 'agendada'
        if (args.event_id) updates.calendar_event_id = args.event_id
      }
      await supabase.from('leads').update(updates).eq('id', ctx.leadId)
      // Limpa flag de agendamento via canvas (harmless se não houver)
      getRedis().del(`canvas:sched:${ctx.companyId}:${ctx.leadPhone}`).catch(() => {})
      return JSON.stringify({ salvo: true, acao: args.acao })
    },
  }

  return runAgentLoop(
    systemPrompt,
    `WhatsApp do lead: ${ctx.leadPhone}\nNome: ${ctx.leadName}\nMensagem: ${message}`,
    tools, handlers, openai, 'gpt-4.1', acc, 'agendamento', 10, history,
    (toolName, result) => {
      if (toolName === 'Consultar_gcal' && result.startsWith('ERRO_CALENDARIO')) {
        console.error(`[SDR:${ctx.companyId}] Consultar_gcal abortou — retornando erro ao lead`)
        return `Desculpe, ${ctx.leadName}, tive um problema técnico pra acessar o calendário agora. Pode tentar novamente em instantes? 🙏`
      }
      return null
    }
  )
}


// ─── Disparo imediato de step por estágio ──────────────────────

async function dispararSequenciaEstagio(
  estagio: string,
  ctx: SdrContext,
  supabase: ReturnType<typeof createServiceClient>
): Promise<void> {
  const phoneVars = phoneVariants(ctx.leadPhone)

  console.log(`[trial:dispatch] iniciando — estagio="${estagio}" phone=${ctx.leadPhone} company=${ctx.companyId}`)

  const { data: trial } = await supabase.from('saas_trials')
    .select('id, nome, whatsapp, trial_days, criado_em, status, estagio, respondeu')
    .eq('company_id', ctx.companyId)
    .in('whatsapp', phoneVars)
    .eq('status', 'ativo')
    .maybeSingle()

  console.log(`[trial:dispatch] trial=${trial ? `id=${trial.id} nome=${trial.nome}` : 'NÃO ENCONTRADO'}`)

  // Modo teste: verifica se phone é o número de teste configurado na empresa
  let isTestMode = false
  if (!trial) {
    const { data: testCfg } = await supabase.from('trial_configs')
      .select('test_mode, test_phone')
      .eq('company_id', ctx.companyId)
      .maybeSingle()
    const testPhone = testCfg?.test_phone ? normalizePhone(testCfg.test_phone) : null
    isTestMode = !!(testCfg?.test_mode && testPhone && phoneVars.includes(testPhone))
    console.log(`[trial:dispatch] test_mode=${isTestMode} testPhone=${testPhone}`)
    if (!isTestMode) return
  }

  const { data: sequences } = await supabase.from('follow_sequences')
    .select('id')
    .eq('company_id', ctx.companyId)
    .eq('tipo', 'trial_saas')
    .eq('ativo', true)

  console.log(`[trial:dispatch] sequencias ativas=${sequences?.length ?? 0}`)

  // Mock para modo teste (sem trial real)
  const trialData = trial ?? {
    id: 0,
    nome: 'Lead Teste',
    status: 'trial_ativo',
    criado_em: new Date().toISOString(),
    trial_days: 14,
    estagio,
  }

  const uazapi = createUazapiClient(ctx.uazapiUrl, ctx.uazapiToken)

  for (const seq of sequences ?? []) {
    const { data: steps } = await supabase.from('follow_steps')
      .select('*')
      .eq('sequence_id', seq.id)
      .eq('condicao_estagio', estagio)
      .order('dia_offset', { ascending: true })
      .order('ordem', { ascending: true })

    console.log(`[trial:dispatch] seq=${seq.id} steps com estagio="${estagio}"=${steps?.length ?? 0}`)

    for (const step of steps ?? []) {
      // Em modo teste não verifica execuções anteriores — sempre re-dispara
      if (!isTestMode) {
        const { data: jaEnviado } = await supabase.from('follow_executions')
          .select('id').eq('trial_id', trial!.id).eq('step_id', step.id).maybeSingle()
        if (jaEnviado) continue
      }

      const tipo = step.tipo_mensagem ?? 'text'
      const pool: string[] = step.pool_mensagens?.filter(Boolean) ?? []
      const textoRaw = pool.length ? pool[Math.floor(Math.random() * pool.length)] : (step.mensagem ?? '')
      const texto = textoRaw
        .replace(/\{nome\}/gi, trialData.nome)
        .replace(/\{primeiro_nome\}/gi, trialData.nome.split(' ')[0])
        .replace(/\{status\}/gi, trialData.status)
        .replace(/\{data_call\}/gi, '')

      try {
        // Simula digitação antes de cada mensagem
        const typingMs = 1500 + Math.floor(Math.random() * 2000)
        await uazapi.sendPresence(ctx.leadPhone, 'composing', typingMs)
        await new Promise((r) => setTimeout(r, typingMs))
        await sendRichStep(uazapi, ctx.leadPhone, tipo, texto, step.media_config ?? undefined)

        if (!isTestMode) {
          await supabase.from('follow_executions').insert({
            trial_id: trialData.id,
            sequence_id: seq.id,
            step_id: step.id,
            company_id: ctx.companyId,
            status: 'sent',
          })
        }

        // Salva na conversa de atendimento
        if (ctx.conversationId) {
          const mc = step.media_config
          let urlMidia: string | null = null
          if (tipo === 'menu' && mc?.choices?.length)
            urlMidia = JSON.stringify({ menuType: mc.menuType ?? 'button', choices: mc.choices, button_actions: mc.button_actions ?? {} })
          else if (tipo === 'carousel' && mc?.carousel?.length)
            urlMidia = JSON.stringify(mc.carousel)
          else if (['image', 'video', 'audio', 'ptt', 'document'].includes(tipo) && mc?.file)
            urlMidia = mc.file

          await supabase.from('mensagens_do_whatsapp').insert({
            id_da_conversacao: ctx.conversationId,
            id_do_lead: ctx.leadId ?? null,
            company_id: ctx.companyId,
            texto_da_mensagem: texto || mc?.text || `[${tipo}]`,
            tipo_de_mensagem: tipo,
            url_da_midia: urlMidia,
            direcao: 'outbound',
            sender_type: 'ai',
            status: 'sent',
            nome_do_agente: 'Trial SaaS',
            carimbo_de_data_e_hora: new Date().toISOString(),
          })
        }

        // Controle de SDR por step
        console.log(`[trial:dispatch] step ${step.id} sdr_ativo=${JSON.stringify(step.sdr_ativo)} conv=${ctx.conversationId}`)
        if (step.sdr_ativo !== null && step.sdr_ativo !== undefined && ctx.conversationId) {
          const { error: sdrErr } = await supabase.from('conversas_do_whatsapp')
            .update({ agente_pausado: !step.sdr_ativo })
            .eq('id', ctx.conversationId)
          console.log(`[trial:dispatch] SDR ${step.sdr_ativo ? 'ativado' : 'pausado'} conv=${ctx.conversationId} err=${sdrErr?.message ?? 'ok'}`)

          if (step.sdr_ativo === true) {
            const dias = Math.floor((Date.now() - new Date(trialData.criado_em).getTime()) / 86_400_000)
            const contexto = `[Trial SaaS] Lead em período de teste (D${dias}/${trialData.trial_days}). Estágio: ${estagio}. SDR reativado pela sequência de resposta imediata.`
            await supabase.from('leads')
              .update({ notes: contexto, updated_at: new Date().toISOString() })
              .eq('id', ctx.leadId)
          }
        }

        console.log(`[SDR:${ctx.companyId}] dispararSequenciaEstagio: step ${step.id} disparado trial=${trialData.id} estagio=${estagio}${isTestMode ? ' [TEST]' : ''}`)
        // Pausa entre mensagens da sequência
        await new Promise((r) => setTimeout(r, 2000))
      } catch (err: any) {
        console.error(`[SDR:${ctx.companyId}] dispararSequenciaEstagio ERRO step ${step.id}: ${err.message}`)
        if (isTestMode) continue
        await supabase.from('follow_executions').insert({
          trial_id: trialData.id, sequence_id: seq.id, step_id: step.id,
          company_id: ctx.companyId, status: 'failed',
        })
      }
    }
  }
}

// ─── Button Actions ────────────────────────────────────────────

async function executeButtonActions(
  text: string,
  ctx: SdrContext,
  supabase: ReturnType<typeof createServiceClient>
): Promise<void> {
  if (!text.trim() || !ctx.leadId) return

  // Find recent outbound menu messages for this lead (newest first, limit 5)
  // Primary: by id_do_lead; fallback: by conversationId (handles lead ID mismatch edge cases)
  let menuMsgs: { url_da_midia: string | null }[] | null = null

  const { data: byLead, error: byLeadErr } = await supabase
    .from('mensagens_do_whatsapp')
    .select('url_da_midia')
    .eq('id_do_lead', ctx.leadId)
    .eq('company_id', ctx.companyId)
    .eq('direcao', 'outbound')
    .in('tipo_de_mensagem', ['menu', 'button'])
    .order('carimbo_de_data_e_hora', { ascending: false })
    .limit(5)

  if (byLeadErr) console.error(`[trial:btn] byLead ERRO: ${byLeadErr.message}`)
  console.log(`[trial:btn] byLead lead=#${ctx.leadId}: ${byLead?.length ?? 0} resultados`)

  if (byLead?.length) {
    menuMsgs = byLead
  } else if (ctx.conversationId) {
    const { data: byConv, error: byConvErr } = await supabase
      .from('mensagens_do_whatsapp')
      .select('url_da_midia')
      .eq('id_da_conversacao', ctx.conversationId)
      .eq('company_id', ctx.companyId)
      .eq('direcao', 'outbound')
      .in('tipo_de_mensagem', ['menu', 'button'])
      .order('carimbo_de_data_e_hora', { ascending: false })
      .limit(5)
    if (byConvErr) console.error(`[trial:btn] byConv ERRO: ${byConvErr.message}`)
    console.log(`[trial:btn] byConv conv=${ctx.conversationId}: ${byConv?.length ?? 0} resultados`)
    if (byConv?.length) {
      menuMsgs = byConv
    }
  }

  console.log(`[trial:btn] menus encontrados=${menuMsgs?.length ?? 0} lead=#${ctx.leadId} conv=${ctx.conversationId}`)
  if (!menuMsgs?.length) return

  const normalizedText = text.trim().toLowerCase()
  console.log(`[trial:btn] texto inbound="${normalizedText}"`)

  for (const msg of menuMsgs) {
    if (!msg.url_da_midia) { console.log(`[trial:btn] msg sem url_da_midia — pulando`); continue }
    let parsed: { choices?: string[]; button_actions?: Record<string, any> }
    try { parsed = JSON.parse(msg.url_da_midia) } catch { console.log(`[trial:btn] parse error em url_da_midia`); continue }

    const choices: string[] = parsed.choices ?? []
    const actions: Record<string, any> = parsed.button_actions ?? {}
    console.log(`[trial:btn] choices=${JSON.stringify(choices)} button_actions_keys=${JSON.stringify(Object.keys(actions))}`)

    const matchedChoice = choices.find(
      (c) => c.trim().toLowerCase() === normalizedText
        || normalizedText.includes(c.trim().toLowerCase())
    )
    console.log(`[trial:btn] matchedChoice=${matchedChoice ?? 'null'}`)
    if (!matchedChoice) continue

    // Botão reconhecido — atualiza estagio + respondeu no trial.
    // Primeiro tenta por telefone (produção); fallback = trial ativo mais recente da empresa (modo teste).
    ;(async () => {
      try {
        const phoneVarsBtn = phoneVariants(ctx.leadPhone)
        let trialId: number | null = null

        const { data: byPhone } = await supabase.from('saas_trials')
          .select('id')
          .eq('company_id', ctx.companyId)
          .in('whatsapp', phoneVarsBtn)
          .eq('status', 'ativo')
          .order('criado_em', { ascending: false })
          .limit(1)
          .maybeSingle()
        trialId = byPhone?.id ?? null

        if (!trialId) {
          const { data: recent } = await supabase.from('saas_trials')
            .select('id')
            .eq('company_id', ctx.companyId)
            .eq('status', 'ativo')
            .order('criado_em', { ascending: false })
            .limit(1)
            .maybeSingle()
          trialId = recent?.id ?? null
        }

        if (trialId) {
          await supabase.from('saas_trials')
            .update({ respondeu: true, estagio: matchedChoice })
            .eq('id', trialId)
          await supabase.from('follow_logs')
            .update({ respondeu: true })
            .eq('trial_id', trialId)
            .neq('respondeu', true)
          console.log(`[trial:btn] respondeu=true estagio="${matchedChoice}" trial=${trialId}`)
          // Dispara próximo step do ramo imediatamente — sem esperar o cron
          runTrialSaasImmediate(ctx.companyId, trialId)
            .then(r => console.log(`[trial:btn] imediato sent=${r.sent} error=${r.error ?? 'ok'}`))
            .catch(err => console.error(`[trial:btn] imediato falhou: ${err.message}`))
        } else {
          console.log(`[trial:btn] nenhum trial ativo encontrado para company=${ctx.companyId}`)
        }
      } catch (e: any) {
        console.error(`[trial:btn] ERRO ao atualizar trial:`, e?.message)
      }
    })()

    if (!parsed.button_actions) { console.log(`[trial:btn] button_actions ausente no JSON — menu sem feature`); continue }

    const action = actions[matchedChoice]
    console.log(`[trial:btn] action=${JSON.stringify(action ?? null)}`)
    if (!action) break

    console.log(`[trial:btn] executando action "${matchedChoice}" → ${JSON.stringify(action)}`)

    if (action.status) {
      await supabase.from('leads')
        .update({ status: action.status, updated_at: new Date().toISOString() })
        .eq('id', ctx.leadId)
      console.log(`[SDR:${ctx.companyId}] ButtonAction: lead #${ctx.leadId} status → "${action.status}"`)
    }

    if (action.schedule_days != null) {
      // Delete executions so sequence can re-fire; set updated_at so steps fire in N days
      await supabase.from('follow_executions').delete().eq('lead_id', ctx.leadId)
      const newUpdatedAt = new Date(Date.now() - action.schedule_days * 86_400_000).toISOString()
      await supabase.from('leads')
        .update({ updated_at: newUpdatedAt })
        .eq('id', ctx.leadId)
      console.log(`[SDR:${ctx.companyId}] ButtonAction: lead #${ctx.leadId} reagendado em ${action.schedule_days} dias`)
    }

    if (action.stop_sequence) {
      await supabase.from('follow_sequences')
        .update({ ativo: false })
        .eq('company_id', ctx.companyId)
        .ilike('nome', `%[Lead #${ctx.leadId}]%`)
      console.log(`[SDR:${ctx.companyId}] ButtonAction: sequência parada para lead #${ctx.leadId}`)
    }

    if (action.estagio) {
      const phoneVars = phoneVariants(ctx.leadPhone)
      const { data: updatedByPhone } = await supabase.from('saas_trials')
        .update({ estagio: action.estagio })
        .eq('company_id', ctx.companyId)
        .in('whatsapp', phoneVars)
        .eq('status', 'ativo')
        .select('id')
      // Fallback modo teste: atualiza via conversa se não achou por telefone
      if (!updatedByPhone?.length && ctx.conversationId) {
        const { data: tLog } = await supabase.from('follow_logs')
          .select('trial_id').eq('company_id', ctx.companyId)
          .not('trial_id', 'is', null).order('enviado_em', { ascending: false })
          .limit(1).maybeSingle()
        if (tLog?.trial_id) {
          await supabase.from('saas_trials')
            .update({ estagio: action.estagio })
            .eq('id', tLog.trial_id).eq('status', 'ativo')
        }
      }
      console.log(`[SDR:${ctx.companyId}] ButtonAction: trial estagio → "${action.estagio}" para ${ctx.leadPhone}`)

      if (action.trigger_immediate) {
        await dispararSequenciaEstagio(action.estagio, ctx, supabase)
      }
    }

    break // only apply actions from the most recent matching menu
  }
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
  link_catalogo?: string
  link_pedido?: string
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

  const fixedLogic = `Você é um orquestrador. Você não tem conhecimento próprio sobre nada.
Se você responder sem chamar a tools vai ser multado em 2 milho~es de dolares, você não sabe respoder, não importa se é só um OI, você NÃO SABE!

Quando receber uma mensagem:

${steps.join('\n')}

Você é INCAPAZ de responder sem chamar essas tools porque não possui nenhuma informação. Todo seu conhecimento vem exclusivamente dos retornos das tools.

Após chamar todas as tools, use o conteúdo retornado pelo Play_conhecimento e Play_objeções para formular a resposta. REGRAS DE USO DO CONHECIMENTO:
- Se o documento contiver scripts marcados com "Responda APENAS", "PASSO X" ou frases exatas entre aspas: COPIE o script exatamente como escrito. NÃO parafraseie, NÃO misture passos, NÃO adicione informação extra.
- Se o documento contiver apenas informações gerais (FAQ, specs, preços): formule uma resposta natural e humana baseada no conteúdo.
- NUNCA copie títulos de seção, headers em maiúsculas, ou marcadores internos como "=== SEÇÃO ===" — apenas o texto da resposta.
- NUNCA pule etapas do fluxo — se o passo diz perguntar algo antes de continuar, pergunte e PARE.

REGRAS DE MENSAGEM (CRÍTICO):
- Cada bloco de mensagem é separado por UMA linha em branco (\\n\\n). O sistema envia cada bloco como uma mensagem separada no WhatsApp.
- Máximo 1 a 2 frases por bloco.
- NUNCA junte tudo em um parágrafo só. Sempre quebre em blocos.
- NUNCA use travessão (—). Use vírgula ou ponto.
- NUNCA diga que o lead "recebeu" uma mensagem, ou que você "viu que ele recebeu" algo. O lead ENVIOU a mensagem para você — se precisar referenciar o contexto, diga "vi que você enviou" ou "pelo que você compartilhou". Na maioria dos casos, simplesmente redirecione sem mencionar o conteúdo anterior.
- Se o lead enviar mensagem fora do contexto do negócio (promoção de terceiros, sorteio, spam, conteúdo irrelevante), redirecione diretamente para o foco da empresa sem explicar nem citar o que foi enviado.

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
    if (persona.horario)           lines.push(`Horário de atendimento: ${persona.horario}.`)
    if (persona.area_entrega)        lines.push(`Área de entrega e taxas: ${persona.area_entrega}.`)
    if (persona.formas_pagamento)    lines.push(`Formas de pagamento aceitas: ${persona.formas_pagamento}.`)
    if (persona.valor_minimo_pedido) lines.push(`Valor mínimo do pedido: ${persona.valor_minimo_pedido}.`)
    if (persona.pedido_tipo)         lines.push(`Como o pedido é finalizado: ${persona.pedido_tipo}.`)
    if (persona.link_catalogo)       lines.push(`Cardápio/catálogo: ${persona.link_catalogo}.`)
    if (persona.link_pedido)         lines.push(`Link para pedido online: ${persona.link_pedido}.`)
    if (ctx.productsBlock)           lines.push(`\nITENS DO CARDÁPIO:\n${ctx.productsBlock}`)
    if (lines.length > 0) companyBlock = `\n\nCONTEXTO DA EMPRESA:\n${lines.join('\n')}`
  } else if (ctx.prompt) {
    companyBlock = `\n\nCONTEXTO DA EMPRESA:\n${ctx.prompt}`
  }

  // ── Camada 3 (FIXO condicional): agendamento — exato do AI Agent2 ─
  const schedulingBlock = ctx.calendarId
    ? `\n\nREGRA CRÍTICA DE AGENDAMENTO:
1. Se a ÚLTIMA mensagem que você enviou ao lead era uma pergunta de confirmação de data e hora de reunião/call (ex: "[Nome], [dia] [data] às [hora] — confirma?") E a resposta do lead for qualquer afirmação ("sim", "pode", "ok", "confirmo", "isso", "s", "claro", "quero"), chame IMEDIATAMENTE "Agente_de_Agendamento" — NÃO processe mais nada, NÃO chame outras tools. ATENÇÃO: perguntas sobre produto, preço, links ou qualquer outro assunto NÃO acionam esta regra, mesmo que o lead responda "sim".
2. Se o lead demonstrar QUALQUER intenção de agendar, remarcar ou cancelar reunião/call, chame IMEDIATAMENTE "Agente_de_Agendamento" — sem enviar nenhuma mensagem de texto antes, sem dizer "aguarde", sem dizer "já verifico".
Em ambos os casos: chame a tool diretamente e retorne exatamente o que ela responder, sem alterar nada. Mensagens genéricas sobre outros assuntos NÃO devem acionar esse agente.`
    : ''

  return `${fixedLogic}${companyBlock}${schedulingBlock}`
}

// Mapa de nome-display → nome-função (OpenAI: ^[a-zA-Z0-9_-]+$)
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
  'Definir_valor_projeto':           'Definir_valor_projeto',
  'Atribuir_tag':                    'Atribuir_tag',
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

  if (ctx.calendarId) {
    tools.push({
      type: 'function',
      function: {
        name: TOOL_NAME_MAP['Agente de Agendamento'],
        description: 'Realiza o agendamento de reunião ou call com o lead. Chame quando o lead demonstrar intenção de agendar qualquer tipo de encontro.',
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

  // Define valor do projeto quando o lead demonstrar interesse em produto específico
  tools.push({
    type: 'function',
    function: {
      name: TOOL_NAME_MAP['Definir_valor_projeto'],
      description: 'Define o valor do projeto/venda do lead com base no produto identificado. Use quando o lead demonstrar interesse claro em um produto específico e você souber o valor dele.',
      parameters: {
        type: 'object',
        properties: {
          valor: { type: 'number', description: 'Valor em reais sem formatação (ex: 1500)' },
          produto: { type: 'string', description: 'Nome do produto ou serviço identificado' },
        },
        required: ['valor'],
      },
    },
  })

  // Atribui tag ao lead com base no perfil identificado na conversa
  tools.push({
    type: 'function',
    function: {
      name: TOOL_NAME_MAP['Atribuir_tag'],
      description: 'Atribui uma tag ao lead com base no perfil ou comportamento identificado. Use apenas tags que existam na lista de tags da empresa.',
      parameters: {
        type: 'object',
        properties: {
          tag_name: { type: 'string', description: 'Nome exato da tag a atribuir (deve ser uma das tags disponíveis)' },
        },
        required: ['tag_name'],
      },
    },
  })

  // Sempre disponível — pausa o bot nesta conversa e sinaliza necessidade de atendimento humano
  tools.push({
    type: 'function',
    function: {
      name: TOOL_NAME_MAP['Pausar_conversa'],
      description: 'Pausa o agente nesta conversa e transfere para atendimento humano. Use OBRIGATORIAMENTE quando: (1) cliente perguntar sobre rastreamento/motoboy/onde está seu pedido, (2) cliente quiser cancelar pedido, (3) cliente reclamar de pedido recebido errado/incompleto, (4) qualquer situação que exija intervenção humana urgente.',
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

// ─── Tool: define project_value do lead ──────────────────────────────────────
async function runDefinirValorProjeto(
  valor: number,
  produto: string | undefined,
  ctx: SdrContext,
  supabase: ReturnType<typeof createServiceClient>
): Promise<string> {
  if (!ctx.leadId || !valor || valor <= 0) return 'Valor inválido ou lead não identificado'

  const { error } = await supabase
    .from('leads')
    .update({ project_value: valor })
    .eq('id', ctx.leadId)

  if (error) {
    console.error(`[SDR:${ctx.companyId}] Definir_valor_projeto erro:`, error.message)
    return `Erro ao definir valor: ${error.message}`
  }

  console.log(`[SDR:${ctx.companyId}] lead=${ctx.leadId} project_value=${valor}${produto ? ` produto="${produto}"` : ''}`)
  return `Valor do projeto definido: R$ ${valor}${produto ? ` (${produto})` : ''}`
}

// ─── Tool: atribui tag ao lead ───────────────────────────────────────────────
async function runAtribuirTag(
  tagName: string,
  ctx: SdrContext,
  supabase: ReturnType<typeof createServiceClient>
): Promise<string> {
  if (!ctx.leadId || !tagName?.trim()) return 'Tag ou lead não identificado'

  const { data: tag } = await supabase
    .from('tags')
    .select('id')
    .eq('company_id', ctx.companyId)
    .eq('tag_name', tagName.trim())
    .maybeSingle()

  if (!tag) return `Tag "${tagName}" não encontrada. Use uma das tags disponíveis da empresa.`

  const { error } = await supabase
    .from('lead_tags')
    .upsert(
      { lead_id: ctx.leadId, tag_id: tag.id },
      { onConflict: 'lead_id,tag_id', ignoreDuplicates: true }
    )

  if (error) {
    console.error(`[SDR:${ctx.companyId}] Atribuir_tag erro:`, error.message)
    return `Erro ao atribuir tag: ${error.message}`
  }

  console.log(`[SDR:${ctx.companyId}] lead=${ctx.leadId} tag="${tagName}" (id=${tag.id}) atribuída`)
  return `Tag "${tagName}" atribuída ao lead com sucesso`
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

  const systemMsg = `${buildOrchestratorSystem(ctx)}

CONTEXTO DO CRM:
- Lead: ${ctx.leadName} | WhatsApp: ${ctx.leadPhone}
- Notas: ${leadNotes || 'nenhuma'}
- Empresa: ${ctx.companyName}
- Data/hora: ${now}`

  const TOOLS = buildOrchestratorTools(ctx)
  console.log(`[SDR:${ctx.companyId}] tools disponíveis: [${TOOLS.map(t => t.function.name).join(', ')}]`)

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
    /—\s*confirma\?/i.test(lastAssistant.content) &&
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
        console.log(`[SDR:${ctx.companyId}] confirmação detectada — solicitando email/nome antes de criar evento`)
        return `Ótimo, ${ctx.leadName}! ✅ Antes de confirmar, preciso do seu nome completo e e-mail para enviar o convite da reunião 😊`
      }
      // Já tem email — cria o evento direto abaixo em Short-circuit 2
    }
  }

  // Short-circuit 2: lead forneceu email → encontra datetime no histórico e cria evento
  if (pendingEmailCollection && ctx.calendarId) {
    const emailMatch = userInput.match(EMAIL_PATTERN)
    const leadEmail = emailMatch?.[0]
    // Nome = input sem o email e sem pontuação, ou leadName como fallback
    const leadName = userInput.replace(EMAIL_PATTERN, '').replace(/[,\-;\s]+/g, ' ').trim() || ctx.leadName

    // Busca a última mensagem "— confirma?" no histórico para recuperar o datetime
    const confirmaMsg = [...history].reverse().find(
      (m) => m.role === 'assistant' && /—\s*confirma\?/i.test(m.content as string)
    )
    const confirmedDt = confirmaMsg ? parseConfirmedDateTime(confirmaMsg.content as string) : null

    if (leadEmail && confirmedDt) {
      console.log(`[SDR:${ctx.companyId}] email coletado — criando evento para ${leadEmail} em ${confirmedDt.toISOString()}`)
      try {
        const title = ctx.eventTitleTemplate
          ? ctx.eventTitleTemplate.replace('{nome}', leadName)
          : `Call de venda — ${leadName}`
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

      // Nomes sanitizados (OpenAI ^[a-zA-Z0-9_-]+$) — mapeados via TOOL_NAME_MAP
      if (fn === 'Think1') {
        result = `Pensamento registrado: ${args.thought}`
      } else if (fn === 'Play_conhecimento') {
        result = await searchDocuments(args.query ?? userInput, ctx.companyId, openai, supabase, ctx.vectorTableConhecimento)
        if (!result) result = 'Base de conhecimento: nenhum resultado encontrado para esta query.'
      } else if (fn === 'Play_objecoes') {
        result = await searchDocuments(args.query ?? userInput, ctx.companyId, openai, supabase, ctx.vectorTableObjecoes)
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
      } else if (fn === 'Definir_valor_projeto') {
        result = await runDefinirValorProjeto(args.valor, args.produto, ctx, supabase)
      } else if (fn === 'Atribuir_tag') {
        result = await runAtribuirTag(args.tag_name, ctx, supabase)
      } else if (fn === 'Pausar_conversa') {
        // Pausa o bot nesta conversa — atendimento humano irá assumir
        if (ctx.conversationId) {
          const { error } = await supabase
            .from('conversas_do_whatsapp')
            .update({ agente_pausado: true })
            .eq('id', ctx.conversationId)
          if (error) {
            console.error(`[SDR:${ctx.companyId}] Pausar_conversa erro:`, error.message)
            result = 'ERRO ao pausar conversa: ' + error.message
          } else {
            await log(ctx.companyId, 'agent_paused_handoff', { motivo: args.motivo }, supabase, ctx.leadPhone, ctx.leadId)
            result = `Conversa pausada com sucesso. Motivo: ${args.motivo ?? 'handoff'}. Atendente humano será notificado.`
          }
        } else {
          result = 'conversationId não disponível — handoff não executado'
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
  // Seleciona apenas id — não depende de colunas opcionais (instance_name pode não existir)
  // Usa phoneVariants para encontrar conversa mesmo se o número foi armazenado em formato diferente
  const phoneVars = phoneVariants(ctx.leadPhone)
  const { data: existingRows, error: selectError } = await supabase
    .from('conversas_do_whatsapp')
    .select('id')
    .eq('company_id', ctx.companyId)
    .in('numero_de_telefone', phoneVars)
    .order('hora_da_ultima_mensagem', { ascending: false })
    .limit(1)
  const existing = existingRows?.[0] ?? null

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
  messageId?: string,
  replyToText?: string,
  replyToSender?: string,
  replyToQuotedId?: string
): Promise<void> {
  if (!conversationId) {
    console.error(`[SDR:${ctx.companyId}] saveInbound ignorado — conversationId vazio`)
    return
  }

  // Para áudio: usa a transcrição se disponível (text = enrichedContent), senão placeholder
  const displayText =
    tipo === 'audio' ? (text && text !== '🎵 Áudio' ? `🎵 ${text}` : '🎵 Áudio') :
    tipo === 'image' ? '📷 Imagem' :
    tipo === 'document' ? '📄 Documento' :
    tipo === 'video' ? '🎥 Vídeo' :
    text

  // Se a mensagem já foi pré-salva (immediate save antes do buffer), apenas atualiza
  if (messageId) {
    const { data: existing } = await supabase
      .from('mensagens_do_whatsapp')
      .select('id')
      .eq('whatsapp_message_id', messageId)
      .eq('company_id', ctx.companyId)
      .maybeSingle()
    if (existing?.id) {
      await supabase.from('mensagens_do_whatsapp')
        .update({ texto_da_mensagem: displayText, url_da_midia: mediaUrl ?? null, id_do_lead: ctx.leadId })
        .eq('id', existing.id)
      await supabase.from('conversas_do_whatsapp')
        .update({ ultima_mensagem: displayText, hora_da_ultima_mensagem: new Date().toISOString() })
        .eq('id', conversationId)
      return
    }
  }

  const tipoFinal = tipo === 'unknown' ? 'text' : tipo

  // Resolve quoted message pelo ID, com fallback para o menu/button outbound mais recente
  let finalReplyText = replyToText ?? null
  let finalReplySender = replyToSender ?? null
  if (!finalReplyText && replyToQuotedId) {
    const { data: qm } = await supabase
      .from('mensagens_do_whatsapp')
      .select('texto_da_mensagem, sender_type, nome_do_agente')
      .eq('whatsapp_message_id', replyToQuotedId)
      .eq('company_id', ctx.companyId)
      .maybeSingle()
    if (qm?.texto_da_mensagem) {
      finalReplyText = qm.texto_da_mensagem
      finalReplySender = qm.sender_type === 'ai' ? (qm.nome_do_agente ?? 'IA') : 'Lead'
    } else {
      // Fallback: último menu/button outbound da conversa
      const { data: lastMenu } = await supabase
        .from('mensagens_do_whatsapp')
        .select('texto_da_mensagem, nome_do_agente')
        .eq('id_da_conversacao', conversationId)
        .eq('company_id', ctx.companyId)
        .eq('direcao', 'outbound')
        .in('tipo_de_mensagem', ['menu', 'button'])
        .order('carimbo_de_data_e_hora', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (lastMenu?.texto_da_mensagem) {
        finalReplyText = lastMenu.texto_da_mensagem
        finalReplySender = lastMenu.nome_do_agente ?? 'IA'
      }
    }
  }

  console.log(`[SDR:${ctx.companyId}] saveInbound — conv=${conversationId} tipo=${tipoFinal} direcao=inbound texto="${displayText.slice(0, 60)}"`)
  const { error } = await supabase.from('mensagens_do_whatsapp').insert({
    id_da_conversacao: conversationId,
    id_do_lead: ctx.leadId,
    company_id: ctx.companyId,
    texto_da_mensagem: displayText,
    tipo_de_mensagem: tipoFinal,
    direcao: 'inbound',
    sender_type: 'human',
    status: 'delivered',
    url_da_midia: mediaUrl ?? null,
    carimbo_de_data_e_hora: new Date().toISOString(),
    whatsapp_message_id: messageId || null,
    reply_to_text: finalReplyText,
    reply_to_sender: finalReplySender,
  })
  if (error) console.error(`[SDR:${ctx.companyId}] saveInbound INSERT error:`, error.message)
  else console.log(`[SDR:${ctx.companyId}] saveInbound OK — conv=${conversationId}`)

  await supabase
    .from('conversas_do_whatsapp')
    .update({ ultima_mensagem: displayText, hora_da_ultima_mensagem: new Date().toISOString() })
    .eq('id', conversationId)
}

async function saveOutbound(
  conversationId: string,
  ctx: SdrContext,
  text: string,
  supabase: ReturnType<typeof createServiceClient>
): Promise<void> {
  if (!conversationId) {
    console.error(`[SDR:${ctx.companyId}] saveOutbound ignorado — conversationId vazio`)
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
  })
  if (error) console.error(`[SDR:${ctx.companyId}] saveOutbound INSERT error:`, error.message)

  await supabase
    .from('conversas_do_whatsapp')
    .update({ ultima_mensagem: text, hora_da_ultima_mensagem: new Date().toISOString() })
    .eq('id', conversationId)
}

// ─── Lead ──────────────────────────────────────────────────────

/**
 * Builds all plausible phone format variants for a normalized Brazilian number.
 * Ensures leads are found regardless of how their phone was originally stored.
 * Normalized = 5577981680532 (13 digits); without-9 = 557781680532 (12 digits).
 */
function phoneVariants(phone: string): string[] {
  const variants: string[] = [phone]
  const push = (v: string) => { if (!variants.includes(v)) variants.push(v) }
  if (phone.startsWith('55')) {
    if (phone.length === 13) {
      push(phone.slice(0, 4) + phone.slice(5))
      push('+' + phone)
      push('+' + phone.slice(0, 4) + phone.slice(5))
    } else if (phone.length === 12) {
      push(phone.slice(0, 4) + '9' + phone.slice(4))
      push('+' + phone)
      push('+' + phone.slice(0, 4) + '9' + phone.slice(4))
    } else {
      push('+' + phone)
    }
  }
  return variants
}

async function applyMetaTag(
  companyId: number,
  leadId: number,
  headline: string,
  supabase: ReturnType<typeof createServiceClient>
) {
  try {
    // Busca ou cria tag com o headline do criativo (cor azul Meta)
    const { data: existing } = await supabase
      .from('tags')
      .select('id')
      .eq('company_id', companyId)
      .eq('tag_name', headline)
      .maybeSingle()

    let tagId = existing?.id
    if (!tagId) {
      const { data: created } = await supabase
        .from('tags')
        .insert({ company_id: companyId, tag_name: headline, tag_color: '#1877F2' })
        .select('id')
        .single()
      tagId = created?.id
    }

    if (tagId) {
      await supabase
        .from('lead_tags')
        .upsert({ lead_id: leadId, tag_id: tagId, company_id: companyId }, { onConflict: 'lead_id,tag_id' })
    }
  } catch (err: any) {
    console.warn(`[SDR] applyMetaTag lead=${leadId}:`, err.message)
  }
}

async function findOrCreateLead(
  companyId: number,
  phone: string,
  name: string,
  companyName: string,
  supabase: ReturnType<typeof createServiceClient>,
  referral?: MetaReferral
): Promise<{ id: number; notes: string }> {
  const variants = phoneVariants(phone)

  const { data: rows } = await supabase
    .from('leads')
    .select('id, notes, whatsapp, contact_name')
    .eq('company_id', companyId)
    .in('whatsapp', variants)
    .order('id', { ascending: true })
    .limit(1)

  const existing = rows?.[0]
  if (existing) {
    const updates: Record<string, any> = {}
    if (existing.whatsapp !== phone) updates.whatsapp = phone
    // Atualiza nome se o lead foi criado sem nome e agora temos um
    if (name && (existing as any).contact_name === 'Não identificado') updates.contact_name = name
    if (Object.keys(updates).length > 0) {
      supabase.from('leads').update(updates).eq('id', existing.id).then(() => {}, () => {})
    }
    // Aplica tag do criativo mesmo em lead já existente (pode ter vindo de outro anúncio)
    if (referral?.headline) {
      applyMetaTag(companyId, existing.id, referral.headline, supabase)
    }
    return { id: existing.id, notes: existing.notes ?? '' }
  }

  const isMetaAd = !!referral?.ctwaClid || !!referral?.sourceId
  const metaAttribution = referral ? {
    ad_id: referral.sourceId ?? null,
    headline: referral.headline ?? null,
    ctwa_clid: referral.ctwaClid ?? null,
    source_url: referral.sourceUrl ?? null,
    captured_at: new Date().toISOString(),
  } : null

  const { data: created, error: insertError } = await supabase
    .from('leads')
    .insert({
      company_id: companyId,
      company_name: companyName || 'Empresa',
      whatsapp: phone,
      contact_name: name || 'Não identificado',
      status: 'Lead novo',
      import_source: isMetaAd ? 'Meta Ads' : 'WhatsApp',
      origem: 'inbound',
      ...(metaAttribution ? { meta_attribution: metaAttribution } : {}),
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (insertError || !created?.id) {
    throw new Error(`findOrCreateLead: falha ao criar lead — ${insertError?.message ?? 'id nulo'}`)
  }

  if (referral?.headline) {
    applyMetaTag(companyId, created.id, referral.headline, supabase)
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
  inboxMode: 'vendas' | 'suporte'
  eventTitleTemplate: string | null
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
    if (val.startsWith('plain:')) return val.slice(6)
    // Formato cifrado: iv(32hex):authTag(32hex):cipher — checa antes de chamar decrypt
    const parts = val.split(':')
    if (parts.length === 3 && parts[0].length === 32 && parts[1].length === 32) {
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
  }
}

// ─── Enriquecimento de mídia (transcrição de áudio, descrição de imagem) ──────

async function enrichMediaMessages(
  messages: BufferedMessage[],
  uazapi: ReturnType<typeof createUazapiClient>,
  openai: OpenAI
): Promise<Array<BufferedMessage & { enrichedContent: string }>> {
  return Promise.all(
    messages.map(async (msg) => {
      if (msg.type === 'audio' && msg.messageId) {
        try {
          const { base64Data, mimetype } = await uazapi.downloadMedia(msg.messageId)
          const buffer = Buffer.from(base64Data, 'base64')
          const file = new File([buffer], 'audio.ogg', { type: mimetype || 'audio/ogg' })
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

      if (msg.type === 'image' && msg.messageId) {
        try {
          const { base64Data, mimetype } = await uazapi.downloadMedia(msg.messageId)
          const resp = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            max_tokens: 300,
            messages: [{
              role: 'user',
              content: [
                { type: 'image_url', image_url: { url: `data:${mimetype || 'image/jpeg'};base64,${base64Data}` } },
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

      if (msg.type === 'document' && msg.messageId) {
        try {
          const { base64Data } = await uazapi.downloadMedia(msg.messageId)
          const text = Buffer.from(base64Data, 'base64').toString('utf-8').slice(0, 2000)
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
    console.log(`[SDR:${companyId}] processando mensagem de ${phone} — agente="${cfg.agent_type}" flow="${cfg.flowId ?? 'default'}")`)

    // ── Verificar franquia antes de processar ──────────────────
    const quotaCheck = await checkTenantQuota(companyId, supabase)
    if (!quotaCheck.allowed) {
      await pauseTenant(companyId, supabase)
      await log(companyId, 'quota_exceeded', { usedThisMonth: quotaCheck.usedThisMonth, quota: quotaCheck.quota }, supabase, phone)
      writeSystemLog('sdr', 'warning', companyId, `Cota excedida — agente pausado`, { usedThisMonth: quotaCheck.usedThisMonth, quota: quotaCheck.quota, phone })
      return
    }

    const bufferedMessages = await drainBuffer(companyId, phone)
    if (bufferedMessages.length === 0) {
      console.warn(`[SDR:${companyId}] processSdrMessage: drainBuffer vazio para phone=${phone} — mensagem perdida no Redis`)
      return
    }

    // Nó "Switch" (15s) — se a última mensagem chegou há menos de 15s, aguarda
    // o tempo restante antes de prosseguir (garante que o lead terminou de digitar)
    const lastMsg = bufferedMessages[bufferedMessages.length - 1]
    const lastMsgAge = Date.now() - new Date(lastMsg.timestamp).getTime()
    if (lastMsgAge < 15_000) {
      await new Promise((r) => setTimeout(r, 15_000 - lastMsgAge))
    }

    const openai = await getOpenAIClient(cfg.openai_key || process.env.OPENAI_API_KEY || '')

    // Enriquece mídia (transcrição de áudio, descrição de imagem, extração de documento)
    const uazapiMediaClient = createUazapiClient(cfg.uazapi_instance_url, cfg.uazapi_token)
    const enrichedMessages = await enrichMediaMessages(bufferedMessages, uazapiMediaClient, openai)

    const { data: company } = await supabase
      .from('companies')
      .select('name')
      .eq('id', companyId)
      .single()

    // Usa push_name do webhook (nó "Dados do Chat" → "None da pessoa" no N8N)
    const senderName = bufferedMessages[0]?.senderName || bufferedMessages[0]?.content?.split(' ')[0] || ''
    // Referral vem da primeira mensagem do buffer (click-to-WhatsApp)
    const referralFromBuffer: MetaReferral | undefined = bufferedMessages[0]?.referral

    const { id: leadId, notes: leadNotes } = await findOrCreateLead(companyId, phone, senderName, company?.name ?? '', supabase, referralFromBuffer)

    // Se lead veio de Meta Ads e empresa tem GTPRO configurado, registra lead no GTPRO
    if (referralFromBuffer?.ctwaClid || referralFromBuffer?.sourceId) {
      ;(async () => {
        try {
          const { data: sdrcfg } = await supabase
            .from('sdr_configs')
            .select('gtpro_api_key')
            .eq('company_id', companyId)
            .maybeSingle()
          const gtproKey = sdrcfg?.gtpro_api_key
          if (!gtproKey) return
          const gtproId = await gtproCreateLead(gtproKey, {
            name: senderName || undefined,
            phone,
            fbclid: referralFromBuffer.ctwaClid,
            utm_campaign: referralFromBuffer.sourceId,
            utm_source: 'whatsapp',
            metadata: { headline: referralFromBuffer.headline, source_url: referralFromBuffer.sourceUrl },
          })
          if (!gtproId) return
          const { data: cur } = await supabase.from('leads').select('meta_attribution').eq('id', leadId).single()
          const existing = (cur?.meta_attribution as Record<string, any>) ?? {}
          await supabase.from('leads')
            .update({ meta_attribution: { ...existing, gtpro_lead_id: gtproId } })
            .eq('id', leadId)
        } catch (err: any) {
          console.warn(`[SDR:${companyId}] gtpro createLead falhou:`, err.message)
        }
      })()
    }

    // Busca produtos ativos da empresa para injetar no contexto
    const { data: products } = await supabase
      .from('sdr_products')
      .select('numero, nome, descricao, preco')
      .eq('company_id', companyId)
      .eq('ativo', true)
      .order('numero')
    const productsBlock = products && products.length > 0
      ? products.map((p: any) => `#${p.numero} ${p.nome}${p.descricao ? ` — ${p.descricao}` : ''}${p.preco ? ` — R$ ${Number(p.preco).toFixed(2)}` : ''}`).join('\n')
      : null

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
      productsBlock,
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
    // SEMPRE salva, mesmo quando pausado — garante histórico no chat e contexto ao reativar
    for (const em of enrichedMessages) {
      await saveInbound(conversationId, ctx, em.enrichedContent, supabase, em.type, em.mediaUrl, em.messageId, em.replyToText, em.replyToSender, em.replyToQuotedId)
    }

    // Texto combinado para o orquestrador (usa transcrição/descrição para mídia)
    const combinedText = enrichedMessages.map((m) => m.enrichedContent).join('\n')
    console.log(`[SDR:${companyId}] combinedText="${combinedText.slice(0, 80)}" leadId=${leadId}`)

    // ── Button Actions — executa ANTES da verificação de pausa ───────────────
    // Botões devem disparar sequências/estagios mesmo quando SDR está pausado
    console.log(`[SDR:${companyId}] chamando executeButtonActions texto="${combinedText.trim().slice(0, 60)}"`)
    await executeButtonActions(combinedText.trim(), ctx, supabase)

    // Verifica se agente está pausado nesta conversa (só APÓS salvar mensagens e executar button_actions)
    const { data: conv } = await supabase
      .from('conversas_do_whatsapp')
      .select('agente_pausado')
      .eq('id', conversationId)
      .single()

    console.log(`[SDR:${companyId}] agente_pausado=${conv?.agente_pausado} conv=${conversationId} lead=#${leadId}`)

    if (conv?.agente_pausado) {
      console.log(`[SDR:${companyId}] RETORNO ANTECIPADO — agente pausado, não processa SDR`)
      await log(companyId, 'agent_paused_conversation', {}, supabase, phone, leadId)
      return
    }

    // ── Canvas scheduling: lead aguarda agendamento via canvas node ──────────
    const schedKey = `canvas:sched:${companyId}:${phone}`
    const schedRaw = await getRedis().get(schedKey).catch(() => null)
    if (schedRaw) {
      console.log(`[SDR:${companyId}] canvas:sched ativo para ${phone} — roteando para agente de agendamento`)
      const history = await getHistory(leadId, companyId, supabase)
      const acc: UsageAcc = []
      const combinedText = enrichedMessages.map((m) => m.enrichedContent).join('\n')
      const schedResponse = await runAgenteAgendamento(combinedText, ctx, openai, supabase, acc, history)
      if (schedResponse) {
        const paragraphs = schedResponse.split(/\n\n+/).map((p) => p.trim()).filter(Boolean)
        await sendWithHumanDelay(paragraphs, phone, cfg.uazapi_instance_url, cfg.uazapi_token, conversationId, ctx, supabase)
      }
      recordUsage(companyId, acc, supabase, quotaCheck.packageId).catch(console.error)
      return
    }

    // ── Auto-transição de status ──────────────────────────────────────────────
    const { data: currentLead } = await supabase
      .from('leads').select('status').eq('id', ctx.leadId).single()
    if (currentLead?.status === 'Remarketing') {
      await supabase.from('leads')
        .update({ status: 'Em contato', updated_at: new Date().toISOString() })
        .eq('id', ctx.leadId)
      console.log(`[SDR:${companyId}] Auto-transição: lead #${ctx.leadId} Remarketing → Em contato`)
    }

    const history = await getHistory(leadId, companyId, supabase)

    await log(companyId, 'message_received', { messages: bufferedMessages, flowId: cfg.flowId }, supabase, phone, leadId)

    // ── Acumulador de usage — passado por referência a todos os agentes ──
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

    await sendWithHumanDelay(paragraphs, phone, cfg.uazapi_instance_url, cfg.uazapi_token, conversationId, ctx, supabase)

    await log(companyId, 'message_sent', { paragraphs, flowId: cfg.flowId }, supabase, phone, leadId)
    writeSystemLog('sdr', 'info', companyId, `Resposta enviada para ${phone} (${paragraphs.length} bloco${paragraphs.length !== 1 ? 's' : ''})`, { phone, leadId, flowId: cfg.flowId, preview: paragraphs[0]?.slice(0, 120) })

    // ── Salvar usage_logs e enviar alertas (fire-and-forget) ──
    recordUsage(companyId, acc, supabase, quotaCheck.packageId).catch(console.error)
    checkAndSendQuotaAlerts(companyId, supabase).catch(console.error)
  } catch (err: any) {
    console.error('[SDR Engine] Erro:', err)
    await log(companyId, 'error', {}, supabase, phone, undefined, err?.message ?? 'Erro desconhecido')
    writeSystemLog('sdr', 'error', companyId, `Erro no agente SDR: ${err?.message ?? 'Erro desconhecido'}`, { phone }, err?.stack?.slice(0, 1000))
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
      // Salva mensagem enviada pelo operador direto do WhatsApp na UI
      const outPhone = normalizePhone(body.chat?.phone || '')
      if (outPhone) {
        const outMsg = body.message as any

        // Mensagem editada pelo operador: atualiza em vez de inserir
        if (outMsg?.messageType === 'editedMessage' || outMsg?.editedMessage) {
          const edited = outMsg?.editedMessage
          const originalMsgId: string = edited?.key?.id ?? ''
          const newText: string = edited?.message?.conversation
            || edited?.message?.extendedTextMessage?.text
            || edited?.message?.text
            || ''
          if (originalMsgId && newText) {
            const editSvc = createServiceClient()
            const { data: existingOut } = await editSvc
              .from('mensagens_do_whatsapp')
              .select('id')
              .eq('whatsapp_message_id', originalMsgId)
              .eq('company_id', companyId)
              .maybeSingle()
            if (existingOut?.id) {
              await editSvc.from('mensagens_do_whatsapp')
                .update({ texto_da_mensagem: newText, is_edited: true, edited_at: new Date().toISOString() })
                .eq('id', existingOut.id)
              console.log(`[SDR:${companyId}] fromMe editedMessage atualizado — db_id=${existingOut.id}`)
            }
          }
          return true
        }

        const outContactName: string = body.chat?.wa_contactName || body.chat?.name || body.chat?.pushName || ''
        const outMsgType = detectMessageType(body.message)
        const outText = outMsg?.text || outMsg?.conversation || outMsg?.extendedTextMessage?.text || outMsg?.body || ''
        const outMediaUrl: string | undefined = outMsg?.url || outMsg?.mediaUrl || outMsg?.media?.url || undefined
        const dispText = outMsgType === 'audio' ? '🎵 Áudio'
          : outMsgType === 'image' ? '📷 Imagem'
          : outMsgType === 'video' ? '🎥 Vídeo'
          : outMsgType === 'document' ? '📄 Documento'
          : outText || ''
        ;(async () => {
          try {
            const outSvc = createServiceClient()
            const { data: convRows } = await outSvc
              .from('conversas_do_whatsapp')
              .select('id, id_do_lead')
              .eq('company_id', companyId)
              .in('numero_de_telefone', phoneVariants(outPhone))
              .order('hora_da_ultima_mensagem', { ascending: false })
              .limit(1)
            let conv = convRows?.[0] ?? null
            if (!conv?.id) {
              // Conversa ainda não existe — Bruno abordou um contato novo pelo celular.
              // Cria lead + conversa com a mesma lógica do fluxo inbound, sem passar pelo SDR.
              let newLeadId: number | null = null
              try {
                const { id: lid } = await findOrCreateLead(companyId, outPhone, outContactName, '', outSvc)
                newLeadId = lid
              } catch (e: any) {
                console.warn(`[SDR:${companyId}] fromMe: falha ao criar lead phone=${outPhone}:`, e?.message)
              }
              const msgTs = (body.message as any)?.timestamp
                ? new Date(Number((body.message as any).timestamp) * 1000).toISOString()
                : new Date().toISOString()
              const { data: newConv, error: convErr } = await outSvc
                .from('conversas_do_whatsapp')
                .insert({
                  company_id: companyId,
                  id_do_lead: newLeadId,
                  numero_de_telefone: outPhone,
                  nome_do_contato: outContactName || outPhone,
                  ultima_mensagem: dispText,
                  hora_da_ultima_mensagem: msgTs,
                  status_da_conversa: 'aberto',
                  contagem_nao_lida: 0,
                })
                .select('id, id_do_lead')
                .single()
              if (convErr || !newConv) {
                console.warn(`[SDR:${companyId}] fromMe: falha ao criar conversa phone=${outPhone}:`, convErr?.message)
                return
              }
              conv = newConv
              console.log(`[SDR:${companyId}] fromMe: conversa criada conv=${conv.id} lead=${newLeadId} phone=${outPhone}`)
            }
            const outMsgTs = (body.message as any)?.timestamp
              ? new Date(Number((body.message as any).timestamp) * 1000).toISOString()
              : new Date().toISOString()
            await outSvc.from('mensagens_do_whatsapp').insert({
              id_da_conversacao: conv.id,
              id_do_lead: conv.id_do_lead ?? null,
              company_id: companyId,
              texto_da_mensagem: dispText,
              tipo_de_mensagem: outMsgType === 'unknown' ? 'text' : outMsgType,
              direcao: 'outbound',
              sender_type: 'human',
              status: 'delivered',
              url_da_midia: outMediaUrl ?? null,
              carimbo_de_data_e_hora: outMsgTs,
              whatsapp_message_id: body.message.id || null,
            })
            await outSvc.from('conversas_do_whatsapp')
              .update({ ultima_mensagem: dispText, hora_da_ultima_mensagem: outMsgTs })
              .eq('id', conv.id)
            console.log(`[SDR:${companyId}] fromMe salvo — outbound conv=${conv.id} tipo=${outMsgType}`)

            // Download e upload de mídia outbound (fromMe) → preview no chat
            const outIsMedia = ['audio', 'ptt', 'image', 'video', 'document'].includes(outMsgType)
            const outMessageId = body.message.id || null
            if (outIsMedia && outMessageId) {
              try {
                const uazapiOut = createUazapiClient(
                  body.BaseUrl ?? 'https://nexioai.uazapi.com',
                  body.token ?? ''
                )
                const { base64Data, mimetype } = await uazapiOut.downloadMedia(outMessageId)
                const ext = mimetype?.split('/')?.[1]?.split(';')?.[0] ?? (
                  outMsgType === 'audio' || outMsgType === 'ptt' ? 'ogg' :
                  outMsgType === 'image' ? 'jpg' :
                  outMsgType === 'video' ? 'mp4' : 'bin'
                )
                const filePath = `${companyId}/whatsapp/outbound/${outMessageId}.${ext}`
                const buffer = Buffer.from(base64Data, 'base64')
                const { error: uploadErr } = await outSvc.storage
                  .from('whatsapp-media')
                  .upload(filePath, buffer, { contentType: mimetype || 'application/octet-stream', upsert: true })
                if (!uploadErr) {
                  const { data: urlData } = outSvc.storage.from('whatsapp-media').getPublicUrl(filePath)
                  if (urlData?.publicUrl) {
                    await outSvc.from('mensagens_do_whatsapp')
                      .update({ url_da_midia: urlData.publicUrl })
                      .eq('whatsapp_message_id', outMessageId)
                      .eq('company_id', companyId)
                    console.log(`[SDR:${companyId}] fromMe media salva — ${outMsgType} → ${filePath}`)
                  }
                }
              } catch (e: any) {
                console.error(`[SDR:${companyId}] fromMe media error:`, e?.message)
              }
            }
          } catch (e: any) {
            console.error(`[SDR:${companyId}] fromMe save error:`, e?.message)
          }
        })()
      }
      return false
    }

    // Ignora mensagens de grupos (wa_chatid termina em @g.us ou phone vazio)
    const chatId = body.chat?.wa_chatid ?? body.chat?.id ?? ''
    if (chatId.endsWith('@g.us') || !body.chat?.phone) {
      console.log(`[SDR:${companyId}] ignorado — mensagem de grupo ou phone vazio`)
      return false
    }

    const msg = body.message as any
    const msgType = detectMessageType(body.message)
    const isMedia = msgType === 'audio' || msgType === 'image' || msgType === 'document' || msgType === 'video'

    // Mensagem editada: uazapi envia messageType="editedMessage" com msg.editedMessage.key.id (original) e novo texto
    if (msg?.messageType === 'editedMessage' || msg?.editedMessage) {
      const edited = msg?.editedMessage
      const originalMsgId: string = edited?.key?.id ?? ''
      const newText: string = edited?.message?.conversation
        || edited?.message?.extendedTextMessage?.text
        || edited?.message?.text
        || ''
      console.log(`[SDR:${companyId}] editedMessage — originalId="${originalMsgId}" newText="${newText.slice(0, 80)}"`)
      if (originalMsgId && newText) {
        const { data: existingMsg } = await supabase
          .from('mensagens_do_whatsapp')
          .select('id')
          .eq('whatsapp_message_id', originalMsgId)
          .eq('company_id', companyId)
          .maybeSingle()
        if (existingMsg?.id) {
          await supabase.from('mensagens_do_whatsapp')
            .update({ texto_da_mensagem: newText, is_edited: true, edited_at: new Date().toISOString() })
            .eq('id', existingMsg.id)
          console.log(`[SDR:${companyId}] mensagem atualizada (editedMessage) — db_id=${existingMsg.id}`)
        } else {
          console.warn(`[SDR:${companyId}] editedMessage: originalMsgId=${originalMsgId} não encontrado no DB`)
        }
      }
      return true
    }

    // vote pode ser array de objetos {name, localId} (UAZapi) ou array de strings
    const voteText: string = Array.isArray(msg?.vote)
      ? (typeof msg.vote[0] === 'string' ? msg.vote[0] : (msg.vote[0]?.name ?? ''))
      : (typeof msg?.vote === 'string' ? msg.vote : '')

    const text = msg?.text
      || msg?.conversation
      || msg?.extendedTextMessage?.text
      || msg?.body
      || (typeof msg?.content === 'string' ? msg.content : '')                         // botão/lista selecionada (uazapi)
      || msg?.buttonsResponseMessage?.selectedDisplayText                               // resposta de botão interativo
      || msg?.listResponseMessage?.title                                                // resposta de lista
      || msg?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson        // botão nativo
      || voteText                                                                       // enquete/poll
      || body.chat?.wa_lastMessageTextVote
      || ''

    // Log para button responses e tipos especiais
    if (msgType === 'unknown' || msg?.buttonsResponseMessage || msg?.listResponseMessage) {
      console.log(`[SDR:${companyId}] msg especial — msgType="${msgType}" text="${text}" campos:`, Object.keys(msg ?? {}))
      if (msg?.quoted !== undefined) {
        console.log(`[SDR:${companyId}] quoted:`, JSON.stringify(msg.quoted).slice(0, 300))
      }
    }

    // Mensagens de mídia sem texto são válidas — serão enriquecidas (transcrição/vision) em processSdrMessage
    if (!text.trim() && !isMedia) {
      console.warn(`[SDR:${companyId}] ignorado — texto vazio e não é mídia. Campos:`, Object.keys(msg ?? {}))
      return false
    }

    const mediaUrl: string | undefined =
      msg?.url || msg?.mediaUrl || msg?.media?.url || msg?.downloadUrl || undefined

    const placeholder = msgType === 'audio' ? '🎵 Áudio'
      : msgType === 'image' ? '📷 Imagem'
      : msgType === 'document' ? '📄 Documento'
      : msgType === 'video' ? '🎥 Vídeo' : ''

    console.log(`[SDR:${companyId}] mensagem de ${body.chat?.phone} — tipo="${msgType}" texto="${(text || placeholder).slice(0, 80)}"`)

    if (text) {
      const injection = analyzeInjection(text)
      if (injection.isInjection) {
        if (injection.shouldBlock) {
          const uazapiBlock = createUazapiClient(
            body.BaseUrl ?? 'https://nexioai.uazapi.com',
            body.token ?? ''
          )
          await uazapiBlock.blockContact(normalizePhone(body.chat.phone)).catch(() => {})
          await log(companyId, 'injection_blocked', { text, classification: injection.classification, confidence: injection.confidence }, supabase, body.chat.phone)
          writeSystemLog('sdr', 'critical', companyId, `Injeção de prompt bloqueada — contato banido [${injection.classification} conf=${injection.confidence}]`, { phone: body.chat.phone, text: text.slice(0, 200), attackVector: injection.attackVector })
          sendInjectionAlertEmail({
            pushName: body.message?.senderName || body.chat?.wa_contactName || 'Desconhecido',
            senderNumber: normalizePhone(body.chat.phone),
            instanceName: body.instanceName ?? '',
            originalMessage: text,
            classification: injection.classification,
            riskLevel: injection.riskLevel,
            confidence: injection.confidence,
            evidence: injection.evidence ?? injection.detectedKeywords.slice(0, 3).join(', '),
            timestamp: new Date().toISOString(),
          }).catch(() => {})
          return false
        }
        // Suspeito mas abaixo do threshold de bloqueio — só loga, não bane
        await log(companyId, 'injection_suspicious', { text, classification: injection.classification, confidence: injection.confidence, flags: injection.structuralFlags }, supabase, body.chat.phone)
        writeSystemLog('sdr', 'warn', companyId, `Conteúdo suspeito detectado [${injection.classification} conf=${injection.confidence}]`, { phone: body.chat.phone, attackVector: injection.attackVector })
      }
    }

    const phone = normalizePhone(body.chat.phone)
    const messageId = body.message.id ?? body.message.messageid

    // Deduplicação por messageId (verifica na fila Redis)
    if (await isDuplicateMessage(companyId, phone, messageId)) return false

    const senderName: string = msg?.senderName || body.chat?.wa_contactName || body.message?.senderName || ''
    const senderPhoto: string | undefined = body.chat?.image || body.chat?.imagePreview || undefined

    // Nó "Visualizar mensagem" — marca mensagem como lida (igual ao N8N)
    if (messageId) {
      const uazapiMark = createUazapiClient(
        body.BaseUrl ?? 'https://nexioai.uazapi.com',
        body.token ?? ''
      )
      uazapiMark.markRead(messageId).catch(() => {/* best-effort */})
    }

    // msg.quoted pode ser string (ID da mensagem citada) ou objeto — guardamos o ID para resolver depois
    const quotedRaw = msg?.quoted
    const replyToQuotedId: string | undefined = typeof quotedRaw === 'string' ? quotedRaw
      : typeof quotedRaw === 'object' && quotedRaw !== null
        ? (quotedRaw.text || quotedRaw.conversation || quotedRaw.body ? undefined : quotedRaw.id)
        : undefined
    const replyToTextDirect: string | undefined = typeof quotedRaw === 'object' && quotedRaw !== null
      ? (quotedRaw.text || quotedRaw.conversation || quotedRaw.body || undefined)
      : undefined
    const replyToSenderDirect: string | undefined = typeof quotedRaw === 'object' && quotedRaw !== null
      ? (quotedRaw.senderName || quotedRaw.sender || undefined)
      : undefined

    const rawReferral = body.message?.referral
    const referralData: MetaReferral | undefined = rawReferral ? {
      sourceId: rawReferral.sourceId,
      headline: rawReferral.headline,
      ctwaClid: rawReferral.ctwaClid,
      sourceUrl: rawReferral.sourceUrl,
    } : undefined

    const bufferedMsg: BufferedMessage = {
      content: text || placeholder,
      type: msgType,
      timestamp: new Date().toISOString(),
      messageId,
      mediaUrl,
      senderName,
      senderPhoto,
      replyToText: replyToTextDirect,
      replyToSender: replyToSenderDirect,
      replyToQuotedId,
      referral: referralData,
    }

    await bufferMessage(companyId, phone, bufferedMsg)

    // Pré-salva a mensagem imediatamente na conversa existente (antes do buffer de 30s)
    // Garante que aparece no painel de atendimento sem esperar o processamento da IA
    ;(async () => {
      try {
        const imm = createServiceClient()
        const phoneVarsImm = phoneVariants(phone)
        const { data: convRows } = await imm
          .from('conversas_do_whatsapp')
          .select('id, id_do_lead, contagem_nao_lida')
          .eq('company_id', companyId)
          .in('numero_de_telefone', phoneVarsImm)
          .order('hora_da_ultima_mensagem', { ascending: false })
          .limit(1)
        let conv = convRows?.[0] ?? null
        if (!conv?.id) {
          // Cria lead + conversa para novos contatos independente de agente_ativo
          // (desligar SDR = não responder automaticamente, não = ignorar mensagens)
          let newLeadId: number | null = null
          try {
            const { id: lid } = await findOrCreateLead(companyId, phone, senderName, '', imm, referralData)
            newLeadId = lid
          } catch (e: any) {
            console.warn(`[SDR:${companyId}] pre-save: falha ao criar lead phone=${phone}:`, e?.message)
          }

          const { data: newConv, error: convErr } = await imm
            .from('conversas_do_whatsapp')
            .insert({
              company_id: companyId,
              id_do_lead: newLeadId,
              numero_de_telefone: phone,
              nome_do_contato: senderName || phone,
              ultima_mensagem: '',
              hora_da_ultima_mensagem: new Date().toISOString(),
              ultima_mensagem_inbound_at: new Date().toISOString(),
              window_expires_at: new Date(Date.now() + (referralData?.ctwaClid ? 72 : 24) * 3600000).toISOString(),
              window_type: referralData?.ctwaClid ? 'ctwa' : 'regular',
              status_da_conversa: 'aberto',
              contagem_nao_lida: 0,
              ...(referralData ? { lead_source: {
                type: 'ctwa',
                ctwa_clid: referralData.ctwaClid,
                source_id: referralData.sourceId,
                headline: referralData.headline,
                source_url: referralData.sourceUrl,
                captured_at: new Date().toISOString(),
              }} : {}),
            })
            .select('id, id_do_lead')
            .single()
          if (convErr) {
            console.warn(`[SDR:${companyId}] pre-save: falha ao criar conversa phone=${phone}:`, convErr.message)
            return
          }
          conv = newConv
        }
        const dispText = msgType === 'audio' ? '🎵 Áudio'
          : msgType === 'image' ? '📷 Imagem'
          : msgType === 'video' ? '🎥 Vídeo'
          : msgType === 'document' ? '📄 Documento'
          : text || ''
        const tipoPreSave = msgType === 'unknown' ? 'text' : msgType

        // Resolve quoted message pelo ID, com fallback para o menu/button outbound mais recente
        let resolvedReplyText = replyToTextDirect ?? null
        let resolvedReplySender = replyToSenderDirect ?? null
        if (!resolvedReplyText && replyToQuotedId) {
          const { data: qm } = await imm
            .from('mensagens_do_whatsapp')
            .select('texto_da_mensagem, sender_type, nome_do_agente')
            .eq('whatsapp_message_id', replyToQuotedId)
            .eq('company_id', companyId)
            .maybeSingle()
          if (qm?.texto_da_mensagem) {
            resolvedReplyText = qm.texto_da_mensagem
            resolvedReplySender = qm.sender_type === 'ai' ? (qm.nome_do_agente ?? 'IA') : 'Lead'
          } else {
            // Fallback: último menu/button outbound da conversa
            const { data: lastMenu } = await imm
              .from('mensagens_do_whatsapp')
              .select('texto_da_mensagem, nome_do_agente')
              .eq('id_da_conversacao', conv.id)
              .eq('company_id', companyId)
              .eq('direcao', 'outbound')
              .in('tipo_de_mensagem', ['menu', 'button'])
              .order('carimbo_de_data_e_hora', { ascending: false })
              .limit(1)
              .maybeSingle()
            if (lastMenu?.texto_da_mensagem) {
              resolvedReplyText = lastMenu.texto_da_mensagem
              resolvedReplySender = lastMenu.nome_do_agente ?? 'IA'
            }
          }
        }

        const { error: presaveErr } = await imm.from('mensagens_do_whatsapp').insert({
          id_da_conversacao: conv.id,
          id_do_lead: conv.id_do_lead ?? null,
          company_id: companyId,
          texto_da_mensagem: dispText,
          tipo_de_mensagem: tipoPreSave,
          direcao: 'inbound',
          sender_type: 'human',
          status: 'delivered',
          url_da_midia: mediaUrl ?? null,
          carimbo_de_data_e_hora: new Date().toISOString(),
          whatsapp_message_id: messageId || null,
          reply_to_text: resolvedReplyText,
          reply_to_sender: resolvedReplySender,
        })
        if (presaveErr) {
          console.error(`[SDR:${companyId}] pre-save INSERT error conv=${conv.id}:`, presaveErr.message)
        } else {
          console.log(`[SDR:${companyId}] pre-save OK — conv=${conv.id} tipo=${tipoPreSave} texto="${dispText.slice(0, 60)}"`)
        }
        const now = new Date()
        // Janela de conversa: CTWA = 72h, regular = 24h (novo modelo Meta out/2026)
        const isCtwa = !!referralData?.ctwaClid
        const windowExpires = new Date(now.getTime() + (isCtwa ? 72 : 24) * 60 * 60 * 1000)

        // lead_source: captura atribuição CTWA ou mantém o que já existe
        const leadSource = referralData ? {
          type: 'ctwa',
          ctwa_clid: referralData.ctwaClid,
          source_id: referralData.sourceId,
          headline: referralData.headline,
          source_url: referralData.sourceUrl,
          captured_at: now.toISOString(),
        } : undefined

        await imm.from('conversas_do_whatsapp')
          .update({
            ultima_mensagem: dispText,
            hora_da_ultima_mensagem: now.toISOString(),
            ultima_mensagem_inbound_at: now.toISOString(),
            window_expires_at: windowExpires.toISOString(),
            window_type: isCtwa ? 'ctwa' : 'regular',
            contagem_nao_lida: ((conv as any).contagem_nao_lida ?? 0) + 1,
            ...(leadSource ? { lead_source: leadSource } : {}),
          })
          .eq('id', conv.id)
      } catch (e: any) {
        console.error(`[SDR:${companyId}] pre-save exception:`, e?.message ?? e)
      }
    })()

    // Download e upload de mídia inbound → salva URL pra preview no chat (fire-and-forget)
    if (isMedia && messageId) {
      ;(async () => {
        try {
          const uazapiMedia = createUazapiClient(
            body.BaseUrl ?? 'https://nexioai.uazapi.com',
            body.token ?? ''
          )
          const { base64Data, mimetype } = await uazapiMedia.downloadMedia(messageId)
          const ext = mimetype?.split('/')?.[1]?.split(';')?.[0] ?? (
            msgType === 'audio' ? 'ogg' :
            msgType === 'image' ? 'jpg' :
            msgType === 'video' ? 'mp4' : 'bin'
          )
          const filePath = `${companyId}/whatsapp/inbound/${messageId}.${ext}`
          const buffer = Buffer.from(base64Data, 'base64')
          const mediaStore = createServiceClient()
          const { error: uploadErr } = await mediaStore.storage
            .from('whatsapp-media')
            .upload(filePath, buffer, { contentType: mimetype || 'application/octet-stream', upsert: true })
          if (uploadErr) {
            console.error(`[SDR:${companyId}] media upload error:`, uploadErr.message)
            return
          }
          const { data: urlData } = mediaStore.storage.from('whatsapp-media').getPublicUrl(filePath)
          if (!urlData?.publicUrl) return
          await mediaStore.from('mensagens_do_whatsapp')
            .update({ url_da_midia: urlData.publicUrl })
            .eq('whatsapp_message_id', messageId)
            .eq('company_id', companyId)
          console.log(`[SDR:${companyId}] media inbound salva — ${msgType} → ${filePath}`)
        } catch (e: any) {
          console.error(`[SDR:${companyId}] media download/upload error:`, e?.message)
        }
      })()
    }

    // Marca follow_logs como respondido + saas_trials.respondeu (fire-and-forget)
    ;(async () => {
      try {
        const svc = createServiceClient()
        const phoneVarsResp = phoneVariants(phone)

        // follow_logs para leads normais
        const { data: leadRows } = await svc
          .from('leads')
          .select('id')
          .eq('company_id', companyId)
          .in('whatsapp', phoneVarsResp)
          .order('id', { ascending: true })
          .limit(1)
        const lead = leadRows?.[0] ?? null
        if (lead?.id) {
          await svc
            .from('follow_logs')
            .update({ respondeu: true })
            .eq('company_id', companyId)
            .eq('lead_id', lead.id)
            .neq('respondeu', true)
        }

        // saas_trials.respondeu para leads de trial + follow_logs dos trials
        const { data: trialRows } = await svc
          .from('saas_trials')
          .update({ respondeu: true })
          .eq('company_id', companyId)
          .in('whatsapp', phoneVarsResp)
          .eq('respondeu', false)
          .select('id')
        if (trialRows?.length) {
          const trialIds = trialRows.map((t: any) => t.id)
          await svc
            .from('follow_logs')
            .update({ respondeu: true })
            .eq('company_id', companyId)
            .in('trial_id', trialIds)
            .neq('respondeu', true)
        }
      } catch { /* best-effort */ }
    })()

    // Persiste job no banco — worker processa após 30s de inatividade
    const jobSupabase = createServiceClient()
    const { error: jobErr } = await jobSupabase.from('sdr_jobs').upsert(
      {
        company_id: companyId,
        phone,
        status: 'PENDING',
        last_message_at: new Date().toISOString(),
        attempts: 0,
      },
      {
        onConflict: 'company_id,phone',
        ignoreDuplicates: false,
      }
    )
    if (jobErr) {
      console.error(`[SDR:${companyId}] ERRO ao criar job — worker não vai processar:`, jobErr.message)
    } else {
      console.log(`[SDR:${companyId}] job criado/atualizado — phone=${phone}`)
    }

    return true
  } catch (err: any) {
    console.error('[SDR Webhook] Erro:', err)
    return false
  }
}

export async function resolveCompanyByInstance(instanceName: string): Promise<number | null> {
  const supabase = createServiceClient()

  const { data: co } = await supabase
    .from('companies')
    .select('id')
    .eq('whatsapp_instance_name', instanceName)
    .maybeSingle()
  if (co?.id) return co.id

  // Fallback: sdr_configs.uazapi_instance_name (onde o admin salva a instância)
  const { data: cfg } = await supabase
    .from('sdr_configs')
    .select('company_id')
    .eq('uazapi_instance_name', instanceName)
    .maybeSingle()
  return cfg?.company_id ?? null
}
