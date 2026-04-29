import { NextRequest, NextResponse } from 'next/server'
import { handleWebhook } from '@/lib/sdr/engine'
import type { UazapiWebhookMessage } from '@/lib/sdr/uazapi'

export const runtime = 'nodejs'
export const maxDuration = 60

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

  // Log do payload bruto para diagnóstico
  console.log('[SDR webhook]', companyId, JSON.stringify(body).slice(0, 500))

  // Aguarda handleWebhook para garantir que o buffer seja gravado antes de retornar
  const handled = await handleWebhook(companyId, body).catch((err) => {
    console.error(`[SDR] Erro no webhook empresa ${companyId}:`, err)
    return false
  })

  return NextResponse.json({ ok: true, handled }, { status: 200 })
}
