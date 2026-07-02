import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

// GET — verificação do webhook pela Meta
// Meta envia hub.mode=subscribe, hub.challenge e hub.verify_token
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
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  console.log('[meta-webhook] evento recebido:', JSON.stringify(body).slice(0, 500))

  // Confirma recebimento imediatamente (Meta exige 200 em < 20s)
  // Processamento assíncrono a implementar quando integração estiver completa
  const entries = body?.entry ?? []
  for (const entry of entries) {
    for (const change of entry.changes ?? []) {
      const value = change.value
      const phoneNumberId: string = value?.metadata?.phone_number_id ?? ''
      const messages: any[] = value?.messages ?? []
      const statuses: any[] = value?.statuses ?? []

      for (const msg of messages) {
        console.log(`[meta-webhook] mensagem recebida — phoneNumberId=${phoneNumberId} from=${msg.from} type=${msg.type} text=${msg.text?.body ?? ''}`)
      }

      for (const status of statuses) {
        console.log(`[meta-webhook] status atualizado — id=${status.id} status=${status.status}`)
      }
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
