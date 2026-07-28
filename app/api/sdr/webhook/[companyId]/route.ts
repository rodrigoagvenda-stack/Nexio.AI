import { NextRequest, NextResponse } from 'next/server'
import { handleWebhook } from '@/lib/sdr/engine'
import type { UazapiWebhookMessage } from '@/lib/sdr/uazapi'
import { syslog } from '@/lib/logger'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: NextRequest, props: { params: Promise<{ companyId: string }> }) {
  const params = await props.params;
  const webhookToken = request.headers.get('x-webhook-token')
  const expectedToken = process.env.SDR_WEBHOOK_SECRET
  console.log(`[webhook] recebido — companyId=${params.companyId} tokenOk=${!!expectedToken && webhookToken === expectedToken}`)
  if (!expectedToken || webhookToken !== expectedToken) {
    console.log(`[webhook] auth falhou — SDR_WEBHOOK_SECRET definido=${!!expectedToken}`)
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const companyId = parseInt(params.companyId, 10)

  if (isNaN(companyId) || companyId <= 0) {
    return NextResponse.json({ error: 'companyId inválido' }, { status: 400 })
  }

  let body: UazapiWebhookMessage
  try {
    body = await request.json()
  } catch {
    void syslog({ type: 'sdr', severity: 'error', message: `Webhook SDR: body inválido`, company_id: companyId })
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const msgType = (body as any).type ?? 'unknown'
  const from = (body as any).from ?? (body as any).data?.from ?? '?'
  console.log(`[webhook] company=${companyId} msgType=${msgType} from=${from}`)

  // Retorna 200 imediatamente — o handleWebhook pode levar 30-45s (buffer + switch).
  // Fire-and-forget é seguro em standalone Docker: o processo continua após a response.
  handleWebhook(companyId, body).then(async (handled) => {
    if (handled) {
      await syslog({
        type: 'sdr',
        severity: 'info',
        message: `SDR processou mensagem [${msgType}] de ${from}`,
        payload: { msgType, from },
        company_id: companyId,
      })
    }
  }).catch(async (err) => {
    console.error(`[SDR] Erro no webhook empresa ${companyId}:`, err)
    await syslog({
      type: 'sdr',
      severity: 'error',
      message: `SDR webhook falhou — empresa ${companyId}: ${err.message}`,
      payload: { error: err.message, stack: err.stack?.slice(0, 500), msgType, from },
      company_id: companyId,
    })
  })

  return NextResponse.json({ ok: true }, { status: 200 })
}
