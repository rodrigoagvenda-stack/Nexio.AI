/**
 * Entender o que a EMPRESA mandou em mídia (áudio, imagem). Achado ao vivo 2026-09-21 (lead Isaías): o follow-up
 * era um áudio, mas o histórico guardava um texto órfão do editor ("...falar sobre Fundação Digital...") que não
 * era o que o áudio dizia. O lead respondeu "não entendi" e o SDR/funil raciocinou em cima de uma fala que nunca
 * foi dita. A fonte da verdade é o ARQUIVO que foi enviado: áudio é transcrito, imagem é descrita, texto é o
 * próprio texto. Cada fluxo pode trocar o áudio, usar imagem ou texto, e o sistema entende o que saiu.
 *
 * O resultado fica em mensagens_do_whatsapp.metadados.transcricao (o mesmo campo que já guarda o áudio do lead),
 * então o funil, o orquestrador e a memória leem sem mudança. O mesmo arquivo reenviado a vários leads é
 * entendido uma vez (cache por URL).
 */
import type OpenAI from 'openai'
import type { createServiceClient } from '@/lib/supabase/server'

type Supabase = ReturnType<typeof createServiceClient>

const MEDIA_TYPES = new Set(['audio', 'ptt', 'image'])
const MAX_PER_CALL = 3
const CACHE_MAX = 300
const cache = new Map<string, string>()

export interface MediaRow {
  id?: number | string
  direcao?: string | null
  tipo_de_mensagem?: string | null
  url_da_midia?: string | null
  metadados?: unknown
}

function cacheSet(url: string, text: string) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string)
  cache.set(url, text)
}

/** Mídia da empresa, com arquivo acessível, que ainda não tem o conteúdo entendido. */
export function needsUnderstanding(row: MediaRow): boolean {
  if (row.direcao !== 'outbound') return false
  if (!MEDIA_TYPES.has(row.tipo_de_mensagem ?? '')) return false
  if (!/^https?:\/\//i.test(row.url_da_midia ?? '')) return false
  const t = (row.metadados as { transcricao?: string } | null)?.transcricao
  return !(typeof t === 'string' && t.trim())
}

async function transcribeAudioUrl(url: string, openai: OpenAI): Promise<string | null> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`fetch áudio falhou: ${res.status}`)
  const buffer = Buffer.from(await res.arrayBuffer())
  const contentType = res.headers.get('content-type') || 'audio/mpeg'
  const ext = contentType.includes('ogg') ? 'ogg' : contentType.includes('wav') ? 'wav' : contentType.includes('mp4') || contentType.includes('m4a') ? 'm4a' : 'mp3'
  const file = new File([buffer], `audio.${ext}`, { type: contentType })
  const out = await openai.audio.transcriptions.create({ file, model: 'whisper-1', language: 'pt' })
  const text = out.text?.trim()
  return text ? `[Áudio que enviamos, dizia] ${text}` : null
}

async function describeImageUrl(url: string, openai: OpenAI): Promise<string | null> {
  const resp = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 300,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url } },
          { type: 'text', text: 'Esta imagem foi enviada por uma empresa a um cliente pelo WhatsApp. Descreva em poucas frases o que ela mostra e copie o texto que aparece nela, sem opinar.' },
        ],
      },
    ],
  })
  const desc = resp.choices[0]?.message?.content?.trim()
  return desc ? `[Imagem que enviamos] ${desc}` : null
}

/** Conteúdo entendido do arquivo, ou null se não deu (nunca inventa: sem conteúdo, fica sem). */
export async function understandMedia(tipo: string, url: string, openai: OpenAI): Promise<string | null> {
  const hit = cache.get(url)
  if (hit) return hit
  try {
    const text = tipo === 'image' ? await describeImageUrl(url, openai) : await transcribeAudioUrl(url, openai)
    if (text) cacheSet(url, text)
    return text
  } catch (e: any) {
    console.error('[media-understanding] falhou:', e?.message)
    return null
  }
}

/** Busca as mídias recentes da empresa na conversa que ainda não foram entendidas e entende (best-effort, nunca lança). */
export async function enrichConversationMedia(conversationId: string | number, openai: OpenAI, supabase: Supabase): Promise<void> {
  try {
    const { data } = await supabase
      .from('mensagens_do_whatsapp')
      .select('id, direcao, tipo_de_mensagem, url_da_midia, metadados')
      .eq('id_da_conversacao', conversationId)
      .eq('direcao', 'outbound')
      .in('tipo_de_mensagem', ['audio', 'ptt', 'image'])
      .order('carimbo_de_data_e_hora', { ascending: false })
      .limit(8)
    await enrichOutboundMedia((data ?? []) as (MediaRow & { id: number | string })[], openai, supabase)
  } catch (e: any) {
    console.error('[media-understanding] enrich conversa falhou:', e?.message)
  }
}

/**
 * Entende as mídias recentes da empresa numa conversa que ainda não têm conteúdo (e grava em metadados.transcricao).
 * Mutates: as linhas passadas em `rows` ganham metadados.transcricao, então o chamador já monta a conversa com elas.
 * No máximo MAX_PER_CALL por chamada (as mais recentes), pra não gastar token à toa.
 */
export async function enrichOutboundMedia(rows: (MediaRow & { id: number | string })[], openai: OpenAI, supabase: Supabase): Promise<number> {
  const pendentes = rows.filter(needsUnderstanding).slice(0, MAX_PER_CALL)
  let feitos = 0
  await Promise.all(
    pendentes.map(async (row) => {
      const texto = await understandMedia(row.tipo_de_mensagem as string, row.url_da_midia as string, openai)
      if (!texto) return
      const metadados = { ...((row.metadados as Record<string, unknown> | null) ?? {}), transcricao: texto, transcricao_origem: 'arquivo_enviado' }
      row.metadados = metadados
      feitos++
      await supabase.from('mensagens_do_whatsapp').update({ metadados }).eq('id', row.id)
    })
  )
  return feitos
}
