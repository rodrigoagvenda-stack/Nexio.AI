import { NextRequest, NextResponse } from 'next/server'
import { handleWebhook } from '@/lib/sdr/engine'
import type { UazapiWebhookMessage } from '@/lib/sdr/uazapi'
import { syslog } from '@/lib/logger'

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
    await syslog({ type: 'sdr', severity: 'error', message: `Webhook SDR: body inválido`, company_id: companyId })
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const msgType = (body as any).type ?? 'unknown'
  const from = (body as any).from ?? (body as any).data?.from ?? '?'

  const handled = await handleWebhook(companyId, body).catch(async (err) => {
    console.error(`[SDR] Erro no webhook empresa ${companyId}:`, err)
    await syslog({
      type: 'sdr',
      severity: 'error',
      message: `SDR webhook falhou — empresa ${companyId}: ${err.message}`,
      payload: { error: err.message, stack: err.stack?.slice(0, 500), msgType, from },
      company_id: companyId,
    })
    return false
  })

  if (handled) {
    await syslog({
      type: 'sdr',
      severity: 'info',
      message: `SDR processou mensagem [${msgType}] de ${from}`,
      payload: { msgType, from },
      company_id: companyId,
    })
  }

  return NextResponse.json({ ok: true, handled }, { status: 200 })
}
