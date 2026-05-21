import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { handleWebhook, resolveCompanyByInstance } from '@/lib/sdr/engine'
import type { UazapiWebhookMessage } from '@/lib/sdr/uazapi'

const webhookBodySchema = z.object({
  instanceName: z.string().min(1),
}).passthrough()

export const runtime = 'nodejs'
export const maxDuration = 10

// POST /api/webhook/nexio-uazapi — chat espelhado (mirror)
// Mesmo comportamento do /api/webhook/nexio — rota separada para
// permitir dois webhooks distintos na configuração da uazapi (mensagens + espelho).
export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-webhook-secret')
  if (secret !== process.env.NEXIO_WEBHOOK_SECRET) {
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

  const companyId = await resolveCompanyByInstance(instanceName)
  if (!companyId) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  handleWebhook(companyId, body).catch((err) => {
    console.error(`[Webhook Nexio-UAZapi] Erro empresa ${companyId}:`, err)
  })

  return NextResponse.json({ ok: true })
}
