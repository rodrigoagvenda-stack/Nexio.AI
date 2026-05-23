import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { handleWebhook, resolveCompanyByInstance } from '@/lib/sdr/engine'
import { writeSystemLog } from '@/lib/system-log'
import type { UazapiWebhookMessage } from '@/lib/sdr/uazapi'

const webhookBodySchema = z.object({
  instanceName: z.string().min(1),
}).passthrough()

export const runtime = 'nodejs'
export const maxDuration = 10

// POST /api/webhook/nexio — webhook principal da uazapi
// company_id é resolvido pelo instanceName (campo companies.whatsapp_instance_name)
export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-webhook-secret')
  console.log(`[nexio-webhook] recebido — secretOk=${secret === process.env.NEXIO_WEBHOOK_SECRET}`)
  if (secret !== process.env.NEXIO_WEBHOOK_SECRET) {
    console.log(`[nexio-webhook] auth falhou — NEXIO_WEBHOOK_SECRET definido=${!!process.env.NEXIO_WEBHOOK_SECRET}`)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: UazapiWebhookMessage
  try {
    const parsed = webhookBodySchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
    body = parsed.data as UazapiWebhookMessage
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const instanceName = body.instanceName
  const msgType = (body as any).EventType ?? (body as any).type ?? 'unknown'
  const from = (body as any).chat?.phone ?? (body as any).from ?? '?'
  console.log(`[nexio-webhook] instanceName=${instanceName} msgType=${msgType} from=${from}`)

  const companyId = await resolveCompanyByInstance(instanceName)
  console.log(`[nexio-webhook] resolvedCompany=${companyId ?? 'null (não mapeado)'}`)
  if (!companyId) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  handleWebhook(companyId, body).catch((err) => {
    console.error(`[Webhook Nexio] Erro empresa ${companyId}:`, err)
    writeSystemLog('webhook', 'error', companyId, `Erro no webhook: ${err?.message ?? 'Erro desconhecido'}`, { instanceName }, err?.stack?.slice(0, 1000))
  })

  return NextResponse.json({ ok: true })
}
