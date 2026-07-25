import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const maxDuration = 60

// GET — verificação do webhook pela Meta
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN
  if (mode === 'subscribe' && token === verifyToken) {
    console.log('[meta-webhook] verificação OK')
    return new NextResponse(challenge, { status: 200 })
  }

  console.warn('[meta-webhook] verificação falhou — token inválido')
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// POST — recebe eventos da Meta (mensagens, status, etc.)
export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  // Valida assinatura HMAC-SHA256 da Meta
  const appSecret = process.env.META_APP_SECRET
  if (appSecret) {
    const sig = req.headers.get('x-hub-signature-256') ?? ''
    const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')
    if (!sig || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      console.warn('[meta-webhook] assinatura inválida — rejeitado')
      return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 })
    }
  } else {
    console.warn('[meta-webhook] META_APP_SECRET não configurado — validação HMAC desabilitada')
  }

  let body: any
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  console.log('[meta-webhook] evento recebido:', JSON.stringify(body).slice(0, 500))

  const entries = body?.entry ?? []
  for (const entry of entries) {
    for (const change of entry.changes ?? []) {
      const value = change.value
      const phoneNumberId: string = value?.metadata?.phone_number_id ?? ''
      const messages: any[] = value?.messages ?? []
      const statuses: any[] = value?.statuses ?? []

      for (const msg of messages) {
        // Nunca logar conteúdo da mensagem em produção (LGPD)
        console.log(`[meta-webhook] mensagem recebida — phoneNumberId=${phoneNumberId} from=${msg.from?.slice(0, 4)}**** type=${msg.type}`)
      }

      for (const status of statuses) {
        console.log(`[meta-webhook] status atualizado — id=${status.id} status=${status.status}`)
      }
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
