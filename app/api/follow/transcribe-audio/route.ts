import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { requireAuth } from '@/lib/auth/require-auth'
import { getPlatformConfig } from '@/lib/platform-config'

/**
 * POST /api/follow/transcribe-audio
 * Body: { url: string }
 *
 * Achado ao vivo (Rodrigo, 2026-09-18) : node de áudio no editor do canvas
 * (Automation Canvas) só tem campo de upload de arquivo, nunca teve campo de
 * texto -- o step.mensagem pra esses nodes sempre foi lixo órfão (sobra de
 * quando o node era outro tipo), nunca representou o que é dito de verdade
 * no áudio. Isso fez o SDR responder em cima de premissa falsa (achado ao
 * vivo, lead Samuel : áudio de despedida educada, lead respondeu "ok"
 * aceitando, SDR seguiu empurrando qualificação porque não tinha nenhum
 * registro do que o áudio realmente dizia).
 *
 * Transcreve UMA VEZ no upload (não por mensagem enviada -- o mesmo áudio é
 * reenviado pra várias leads, transcrever a cada envio gastaria token à
 * toa). O resultado vira o step.mensagem de verdade, editável no editor,
 * usado como histórico real pro SDR entender o que já foi dito.
 */
export async function POST(request: NextRequest) {
  const { error: authError } = await requireAuth(request)
  if (authError) return authError

  const body = await request.json().catch(() => ({}))
  const { url } = body as { url?: string }

  if (!url) {
    return NextResponse.json({ error: 'url é obrigatória' }, { status: 400 })
  }

  try {
    const audioRes = await fetch(url)
    if (!audioRes.ok) {
      throw new Error(`Falha ao baixar o áudio (status ${audioRes.status})`)
    }
    const arrayBuffer = await audioRes.arrayBuffer()
    const contentType = audioRes.headers.get('content-type') || 'audio/mpeg'
    const ext = contentType.includes('ogg') ? 'ogg' : contentType.includes('wav') ? 'wav' : contentType.includes('mp4') || contentType.includes('m4a') ? 'm4a' : 'mp3'
    const file = new File([arrayBuffer], `audio.${ext}`, { type: contentType })

    const platformCfg = await getPlatformConfig()
    if (!platformCfg.openai_api_key) {
      return NextResponse.json({ error: 'Chave da OpenAI não configurada na plataforma' }, { status: 400 })
    }
    const openai = new OpenAI({ apiKey: platformCfg.openai_api_key })

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: 'pt',
    })

    return NextResponse.json({ success: true, text: transcription.text?.trim() || '' })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido ao transcrever'
    console.error('[transcribe-audio] erro:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
