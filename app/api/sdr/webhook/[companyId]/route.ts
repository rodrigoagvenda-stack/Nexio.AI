import { NextRequest, NextResponse } from 'next/server'
import { handleWebhook } from '@/lib/sdr/engine'
import type { UazapiWebhookMessage } from '@/lib/sdr/uazapi'

export const runtime = 'nodejs'
export const maxDuration = 10 // responde rápido; processamento é assíncrono

export async function POST(
  request: NextRequest,
  { params }: { params: { companyId: string } }
) {
  const companyId = parseInt(params.companyId, 10)

  if (isNaN(companyId) || companyId <= 0) {
    return NextResponse.json({ error: 'companyId inválido' }, { status: 400 })
  }

  let body: UazapiWebhookMessage
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  // Processa de forma assíncrona para não bloquear a resposta ao uazapi
  handleWebhook(companyId, body).catch((err) => {
    console.error(`[SDR] Erro no webhook empresa ${companyId}:`, err)
  })

  return NextResponse.json({ ok: true }, { status: 200 })
}
