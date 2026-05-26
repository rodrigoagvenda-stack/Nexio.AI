/**
 * Motor 2 — Follow-up AntNoshow
 *
 * Dispara lembretes pré/pós-call para leads com reunião agendada.
 * Janelas: 24h_antes | 2h_antes | 15min_antes | 5min_apos
 * Pool de 50 templates sorteados por janela, com personalização via GPT-4.1.
 * Deduplicação: follow_logs com UNIQUE(lead_id, momento).
 * Rate limit: 30 disparos por execução (fiel ao JSON N8N staticData).
 */

import { createServiceClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/crypto'
import { createUazapiClient, normalizePhone } from './uazapi'

function safeDecrypt(value: string | null | undefined, fallback = ''): string {
  if (!value) return fallback
  if (value.startsWith('plain:')) return value.slice(6)
  const parts = value.split(':')
  if (parts.length === 3 && parts[0].length === 32 && parts[1].length === 32) {
    try { return decrypt(value) } catch { return fallback }
  }
  return value // texto puro sem prefixo
}
import { getSystemConfig } from './system-config'
import OpenAI from 'openai'

// ─── Templates ────────────────────────────────────────────────

type Janela = '24h_antes' | '2h_antes' | '15min_antes' | '5min_apos'

interface Template {
  id: number
  janela: Janela
  texto: string
  usaLink: boolean
}

// Pool de 50 templates fiel ao JSON Follow AntNoshow V2.0
const TEMPLATES: Template[] = [
  // ── 24h_antes (1–15) ──
  { id: 1,  janela: '24h_antes', usaLink: false, texto: 'Oi [Nome]! Passando para te lembrar que amanhã temos nossa conversa marcada 😊 Qualquer dúvida, é só falar!' },
  { id: 2,  janela: '24h_antes', usaLink: false, texto: 'Olá [Nome]! Só um lembrete rápido: nossa reunião é amanhã. Anota aí para não esquecer! 📅' },
  { id: 3,  janela: '24h_antes', usaLink: false, texto: '[Nome], amanhã é o nosso bate-papo! Fico no aguardo. Qualquer coisa, me chama aqui.' },
  { id: 4,  janela: '24h_antes', usaLink: false, texto: 'Hey [Nome]! Passando para confirmar nossa call de amanhã 🎯 Tudo certo por aí?' },
  { id: 5,  janela: '24h_antes', usaLink: false, texto: 'Oi [Nome]! Lembrete carinhoso: nossa reunião é amanhã. Estou preparando tudo para você!' },
  { id: 6,  janela: '24h_antes', usaLink: false, texto: '[Nome], só para não esquecer: amanhã é a nossa conversa! Qualquer dúvida antes, me avisa 😉' },
  { id: 7,  janela: '24h_antes', usaLink: false, texto: 'Olá [Nome]! Animado para nossa reunião de amanhã 🚀 Tem alguma dúvida antes do nosso bate-papo?' },
  { id: 8,  janela: '24h_antes', usaLink: false, texto: 'Oi [Nome]! Confirmando nossa call de amanhã. Posso te mandar o link da reunião mais tarde, ok?' },
  { id: 9,  janela: '24h_antes', usaLink: false, texto: '[Nome], só lembrando: amanhã nos encontramos! Fico no aguardo 😊' },
  { id: 10, janela: '24h_antes', usaLink: false, texto: 'Olá [Nome]! Amanhã é o nosso dia 🌟 Nossa conversa vai ser incrível, tenho certeza!' },
  { id: 11, janela: '24h_antes', usaLink: false, texto: 'Oi [Nome]! Passando para lembrar da nossa reunião amanhã. Fique à vontade para me chamar antes se quiser!' },
  { id: 12, janela: '24h_antes', usaLink: false, texto: '[Nome], é amanhã! Nossa call está confirmada 🎉 Até lá!' },
  { id: 13, janela: '24h_antes', usaLink: false, texto: 'Olá [Nome]! Lembrete de amanhã: nossa conversa está agendada. Mal posso esperar para te ajudar!' },
  { id: 14, janela: '24h_antes', usaLink: false, texto: 'Oi [Nome]! Nossa reunião de amanhã está confirmada. Qualquer dúvida, estou à disposição 👋' },
  { id: 15, janela: '24h_antes', usaLink: false, texto: '[Nome], amanhã nos vemos! Nossa call está agendada e estou animado para conversar com você 😊' },

  // ── 2h_antes (16–30) ──
  { id: 16, janela: '2h_antes', usaLink: false, texto: 'Oi [Nome]! Nossa reunião é daqui a 2 horinhas ⏰ Fique ligado no horário!' },
  { id: 17, janela: '2h_antes', usaLink: false, texto: '[Nome], daqui a 2 horas a gente se fala! Qualquer imprevisto, me avisa 😉' },
  { id: 18, janela: '2h_antes', usaLink: false, texto: 'Olá [Nome]! Contagem regressiva: 2 horas para nossa conversa 🚀' },
  { id: 19, janela: '2h_antes', usaLink: false, texto: 'Oi [Nome]! Nossa call é em breve, em 2 horas. Já se preparando? 😊' },
  { id: 20, janela: '2h_antes', usaLink: false, texto: '[Nome], faltam 2 horas! Nossa reunião está logo aí. Te mando o link em instantes.' },
  { id: 21, janela: '2h_antes', usaLink: false, texto: 'Olá [Nome]! Em 2 horas a gente se encontra. Fico no aguardo 🎯' },
  { id: 22, janela: '2h_antes', usaLink: false, texto: 'Oi [Nome]! Passando para lembrar: nossa call é em 2 horas! Qualquer dúvida, é só falar.' },
  { id: 23, janela: '2h_antes', usaLink: false, texto: '[Nome], faltam 2 horas para nossa conversa! Estou preparado para te atender 🌟' },
  { id: 24, janela: '2h_antes', usaLink: false, texto: 'Olá [Nome]! Nossa reunião começa em 2 horas. Até já! 👋' },
  { id: 25, janela: '2h_antes', usaLink: false, texto: 'Oi [Nome]! Em 2 horas nos reunimos. Fique à vontade para me chamar antes se precisar!' },
  { id: 26, janela: '2h_antes', usaLink: false, texto: '[Nome], lembrete: 2 horas para nossa call! Me avisa se tiver alguma dúvida antes 😊' },
  { id: 27, janela: '2h_antes', usaLink: false, texto: 'Olá [Nome]! Já faltam só 2 horas para a gente conversar. Que tal separar suas dúvidas?' },
  { id: 28, janela: '2h_antes', usaLink: false, texto: 'Oi [Nome]! Nossa reunião é daqui a 2 horas. Confirme sua presença aqui 😉' },
  { id: 29, janela: '2h_antes', usaLink: false, texto: '[Nome], a gente se vê em 2 horinhas! Estou animado para nossa conversa 🎉' },
  { id: 30, janela: '2h_antes', usaLink: false, texto: 'Olá [Nome]! Lembrete de 2 horas: nossa call está confirmada. Até já!' },

  // ── 15min_antes (31–40) ──
  { id: 31, janela: '15min_antes', usaLink: true,  texto: 'Oi [Nome]! Nossa reunião começa em 15 minutinhos 🎯 Acesse pelo link: [link]' },
  { id: 32, janela: '15min_antes', usaLink: true,  texto: '[Nome], faltam 15 minutos! Entre pelo link quando quiser: [link] Te aguardo!' },
  { id: 33, janela: '15min_antes', usaLink: true,  texto: 'Olá [Nome]! Em 15 minutos a gente se encontra. Link da sala: [link] 🚀' },
  { id: 34, janela: '15min_antes', usaLink: true,  texto: 'Oi [Nome]! Quase lá! Nossa call começa em 15 min. Clique aqui para entrar: [link]' },
  { id: 35, janela: '15min_antes', usaLink: true,  texto: '[Nome], 15 minutinhos para nossa conversa! Link de acesso: [link] Fica à vontade para entrar antes 😊' },
  { id: 36, janela: '15min_antes', usaLink: true,  texto: 'Olá [Nome]! Nossa reunião em 15 min. Acesse: [link] Te espero lá!' },
  { id: 37, janela: '15min_antes', usaLink: true,  texto: 'Oi [Nome]! Contagem final: 15 minutos! Link: [link] Até já 🎉' },
  { id: 38, janela: '15min_antes', usaLink: true,  texto: '[Nome], faltam apenas 15 min para nossa call! Clique no link para entrar: [link]' },
  { id: 39, janela: '15min_antes', usaLink: true,  texto: 'Olá [Nome]! Chegou a hora quase! Em 15 min. Link de acesso: [link] 🌟' },
  { id: 40, janela: '15min_antes', usaLink: true,  texto: 'Oi [Nome]! Nossa reunião começa daqui a pouco, em 15 min. Entre pelo link: [link]' },

  // ── 5min_apos (41–50) ──
  { id: 41, janela: '5min_apos', usaLink: true,  texto: 'Oi [Nome]! Nossa reunião começou agora há pouco 😊 Ainda dá tempo! Link: [link]' },
  { id: 42, janela: '5min_apos', usaLink: true,  texto: '[Nome], a reunião já começou! Entre pelo link: [link] Te aguardo!' },
  { id: 43, janela: '5min_apos', usaLink: true,  texto: 'Olá [Nome]! Estou te aguardando na sala 🎯 Acesse: [link]' },
  { id: 44, janela: '5min_apos', usaLink: true,  texto: 'Oi [Nome]! Nossa call iniciou, pode entrar a qualquer momento: [link] 🚀' },
  { id: 45, janela: '5min_apos', usaLink: true,  texto: '[Nome], estou na sala te esperando! Link: [link] Qualquer dificuldade, me avisa aqui 😊' },
  { id: 46, janela: '5min_apos', usaLink: true,  texto: 'Olá [Nome]! A reunião já começou. Pode entrar pelo link: [link] Estou aqui!' },
  { id: 47, janela: '5min_apos', usaLink: true,  texto: 'Oi [Nome]! Esperando por você na sala 🌟 Clique aqui para entrar: [link]' },
  { id: 48, janela: '5min_apos', usaLink: true,  texto: '[Nome], nossa call está rolando! Acesse: [link] Ainda dá tempo para participar!' },
  { id: 49, janela: '5min_apos', usaLink: true,  texto: 'Olá [Nome]! Estou na reunião aguardando você. Entre por aqui: [link] 😊' },
  { id: 50, janela: '5min_apos', usaLink: true,  texto: 'Oi [Nome]! Nossa sala está aberta te esperando. Link: [link] Vem logo! 🎉' },
]

function sortearTemplate(janela: Janela): Template {
  const pool = TEMPLATES.filter((t) => t.janela === janela)
  return pool[Math.floor(Math.random() * pool.length)]
}

function aplicarSubstituicoes(
  texto: string,
  nome: string,
  link: string,
  segmento: string
): string {
  return texto
    .replace(/\[Nome\]/g, nome)
    .replace(/\[link\]/g, link)
    .replace(/\[segmento\]/g, segmento)
}

function capitalizarFrases(texto: string): string {
  return texto
    .split(/([.!?]\s+)/)
    .map((parte, index) =>
      index % 2 === 0
        ? parte.charAt(0).toUpperCase() + parte.slice(1)
        : parte
    )
    .join('')
}

// ─── Verificação de horário comercial ─────────────────────────

async function isHorarioComercial(
  supabase: ReturnType<typeof createServiceClient>
): Promise<boolean> {
  const { data } = await supabase.rpc('check_horario_comercial').maybeSingle()
  // Fallback JS se a function não existir
  if (data === null || data === undefined || typeof data !== 'object') {
    const now = new Date()
    const brt = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
    const hora = brt.getHours()
    const diaSemana = brt.getDay() // 0=dom, 6=sab

    if (diaSemana >= 1 && diaSemana <= 5 && hora >= 9 && hora < 18) return true
    if (diaSemana === 6 && hora >= 9 && hora < 13) return true
    return false
  }
  return !!(data as any)?.horario_ok
}

// ─── Janela de disparo ─────────────────────────────────────────

function calcularJanela(
  callAgendadaPara: string
): { janela: Janela; ok: boolean } {
  const agora = Date.now()
  const callTs = new Date(callAgendadaPara).getTime()
  const diffMs = callTs - agora
  const diffMin = diffMs / 60_000
  const diffHoras = diffMs / 3_600_000

  const statusBloqueados = [
    'nao_interessado', 'descadastrado', 'perdido', 'bloqueado',
    'Perdido', 'Não Interessado', 'no_show', 'cancelada', 'realizada',
  ]

  if (diffHoras >= 23 && diffHoras <= 25) return { janela: '24h_antes', ok: true }
  if (diffHoras >= 1.5 && diffHoras <= 2.5) return { janela: '2h_antes', ok: true }
  if (diffMin >= 10 && diffMin <= 20) return { janela: '15min_antes', ok: true }
  if (diffMin >= -10 && diffMin <= -2) return { janela: '5min_apos', ok: true }

  return { janela: '24h_antes', ok: false }
}

// ─── Deduplicação ─────────────────────────────────────────────

async function jaDisparou(
  leadId: number,
  momento: Janela,
  companyId: number,
  supabase: ReturnType<typeof createServiceClient>
): Promise<boolean> {
  const { data } = await supabase
    .from('follow_logs')
    .select('id')
    .eq('lead_id', leadId)
    .eq('momento', momento)
    .eq('company_id', companyId)
    .limit(1)
    .maybeSingle()

  return !!data
}

async function registrarDisparo(
  leadId: number,
  momento: Janela,
  companyId: number,
  mensagem: string,
  supabase: ReturnType<typeof createServiceClient>
): Promise<void> {
  await supabase.from('follow_logs').insert({
    lead_id: leadId,
    momento,
    company_id: companyId,
    mensagem,
    tipo: 'antnoshow',
    enviado_em: new Date().toISOString(),
  })
}

// ─── Agente IA de personalização ──────────────────────────────

async function gerarMensagemIA(
  lead: {
    contact_name: string
    resumo_ia: string | null
    segment: string | null
    meet_url: string | null
    call_agendada_para: string
  },
  janela: Janela,
  template: Template,
  openai: OpenAI
): Promise<string> {
  const textoBase = aplicarSubstituicoes(
    template.texto,
    lead.contact_name,
    lead.meet_url ?? '',
    lead.segment ?? ''
  )

  const callDate = new Date(lead.call_agendada_para).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })

  const systemPrompt = `Você é um assistente de follow-up de vendas. Personalize a mensagem abaixo de forma natural, mantendo o tom e estrutura original.

Dados do lead:
- Nome: ${lead.contact_name}
- Segmento: ${lead.segment ?? 'não identificado'}
- Contexto (memória): ${lead.resumo_ia ?? 'sem histórico'}
- Data/hora da reunião: ${callDate}
- Janela de disparo: ${janela}
${template.usaLink && lead.meet_url ? `- Link da reunião: ${lead.meet_url}` : ''}

Regras:
- Mantenha o mesmo comprimento e tom
- Não adicione emojis extras além dos já existentes
- Preserve o [link] se existir na mensagem base
- Responda APENAS com a mensagem personalizada, sem explicações`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Mensagem base: ${textoBase}` },
      ],
      max_tokens: 300,
      temperature: 0.1,
    })

    const texto = completion.choices[0]?.message?.content?.trim() ?? textoBase
    return capitalizarFrases(texto)
  } catch {
    return capitalizarFrases(textoBase)
  }
}

// ─── Conversa e mensagem ───────────────────────────────────────

async function gravarMensagemOutbound(
  leadId: number,
  companyId: number,
  phone: string,
  contactName: string,
  texto: string,
  supabase: ReturnType<typeof createServiceClient>
): Promise<void> {
  // Busca por mensagem existente do lead (como no JSON: busca em mensagens, não em conversas)
  const { data: msgExistente } = await supabase
    .from('mensagens_do_whatsapp')
    .select('id_da_conversacao')
    .eq('id_do_lead', leadId)
    .eq('company_id', companyId)
    .limit(1)
    .maybeSingle()

  let conversationId: string | null = msgExistente?.id_da_conversacao ?? null

  // Se não existe conversa, cria
  if (!conversationId) {
    const { data: novaConversa } = await supabase
      .from('conversas_do_whatsapp')
      .insert({
        id_do_lead: leadId,
        company_id: companyId,
        numero_de_telefone: phone,
        nome_do_contato: contactName,
        contagem_nao_lida: 1,
        status_da_conversa: 'aberto',
        ultima_mensagem: texto,
        hora_da_ultima_mensagem: new Date().toISOString(),
      })
      .select('id')
      .single()
    conversationId = novaConversa?.id ?? null
  }

  await supabase.from('mensagens_do_whatsapp').insert({
    id_da_conversacao: conversationId,
    id_do_lead: leadId,
    company_id: companyId,
    texto_da_mensagem: texto,
    tipo_de_mensagem: 'text',
    direcao: 'outbound',
    sender_type: 'ai',
    status: 'sent',
    nome_do_agente: 'Follow-up AntNoshow',
  })

  if (conversationId) {
    await supabase
      .from('conversas_do_whatsapp')
      .update({ ultima_mensagem: texto, hora_da_ultima_mensagem: new Date().toISOString() })
      .eq('id', conversationId)
  }
}

// ─── Entry point ──────────────────────────────────────────────

export interface AntNoshowResult {
  processados: number
  disparados: number
  pulados: number
  errors: string[]
}

export interface AntNoshowOptions {
  force?: boolean      // ignora janela de tempo e horário comercial
  testPhone?: string   // filtra só o lead com esse telefone
}

export async function runAntNoshow(options: AntNoshowOptions = {}): Promise<AntNoshowResult> {
  const { force = false, testPhone } = options
  const supabase = createServiceClient()
  const result: AntNoshowResult = { processados: 0, disparados: 0, pulados: 0, errors: [] }

  // Verifica horário comercial (pulado em modo force)
  if (!force) {
    const horarioOk = await isHorarioComercial(supabase)
    if (!horarioOk) return result
  }

  // Busca leads com call agendada e status ativo
  const { data: leadsRaw, error: leadsErr } = await supabase
    .from('leads')
    .select('id, company_id, contact_name, whatsapp, call_agendada_para, meet_url, resumo_ia, segment, call_status')
    .eq('call_de_venda', true)
    .eq('call_status', 'agendada')
    .not('call_agendada_para', 'is', null)

  if (leadsErr) {
    console.error('[antnoshow] erro ao buscar leads:', leadsErr.message)
    result.errors.push(`query_leads: ${leadsErr.message}`)
    return result
  }
  if (!leadsRaw?.length) {
    console.log('[antnoshow] nenhum lead com call agendada encontrado')
    return result
  }

  // Filtra por telefone de teste se fornecido
  const leads = testPhone
    ? leadsRaw.filter((l) => {
        const norm = (p: string) => p.replace(/\D/g, '')
        return norm(l.whatsapp ?? '') === norm(testPhone)
      })
    : leadsRaw

  if (!leads.length) return result

  // Carrega configurações das empresas únicas (token uazapi + openai)
  const companyIds = Array.from(new Set(leads.map((l) => l.company_id)))
  const { data: configs } = await supabase
    .from('sdr_configs')
    .select('company_id, uazapi_instance_url, uazapi_token, openai_key, agente_ativo')
    .in('company_id', companyIds)
    .eq('agente_ativo', true)

  const configMap = new Map(
    (configs ?? []).map((c) => [c.company_id, c])
  )

  // Rate limit: máximo 30 disparos por execução
  let disparosTotal = 0
  const RATE_LIMIT = 30

  for (const lead of leads) {
    if (disparosTotal >= RATE_LIMIT) break
    result.processados++

    try {
      const { janela, ok } = calcularJanela(lead.call_agendada_para)
      if (!force && !ok) {
        result.pulados++
        continue
      }
      const effectiveJanela: Janela = ok ? janela : '24h_antes'

      const jaFoi = await jaDisparou(lead.id, effectiveJanela, lead.company_id, supabase)
      if (jaFoi) {
        result.pulados++
        continue
      }

      const cfg = configMap.get(lead.company_id)
      if (!cfg) {
        result.pulados++
        continue
      }

      const uazapiToken = safeDecrypt(cfg.uazapi_token)
      const uazapiUrl = cfg.uazapi_instance_url ?? process.env.UAZAPI_URL ?? 'https://vendai.uazapi.com'

      if (!uazapiToken) {
        result.pulados++
        continue
      }

      const openaiKeyFromConfig = safeDecrypt(cfg.openai_key)
      const openaiKey =
        openaiKeyFromConfig ||
        (await getSystemConfig('OPENAI_API_KEY')) ||
        process.env.OPENAI_API_KEY ||
        ''
      const openai = new OpenAI({ apiKey: openaiKey })

      // Sorteia template e gera mensagem via IA
      const template = sortearTemplate(effectiveJanela)
      const mensagem = await gerarMensagemIA(lead, effectiveJanela, template, openai)

      // Anti-ban: delay aleatório 45–135 segundos entre disparos
      if (disparosTotal > 0) {
        const delayMs = (Math.floor(Math.random() * (135 - 45 + 1)) + 45) * 1000
        await new Promise((r) => setTimeout(r, delayMs))
      }

      // Simula typing 2–5 segundos
      const phone = normalizePhone(lead.whatsapp)
      const uazapi = createUazapiClient(uazapiUrl, uazapiToken)
      const typingMs = (Math.floor(Math.random() * (5 - 2 + 1)) + 2) * 1000
      await uazapi.sendPresence(phone, 'composing', typingMs)
      await new Promise((r) => setTimeout(r, typingMs))

      // Envia via uazapi
      await uazapi.sendText({ number: phone, text: mensagem })

      // Registra no follow_logs (deduplicação)
      await registrarDisparo(lead.id, effectiveJanela, lead.company_id, mensagem, supabase)

      // Grava a mensagem no histórico
      await gravarMensagemOutbound(
        lead.id,
        lead.company_id,
        phone,
        lead.contact_name,
        mensagem,
        supabase
      )

      disparosTotal++
      result.disparados++
    } catch (err: any) {
      result.errors.push(`Lead ${lead.id}: ${err.message}`)
    }
  }

  return result
}
