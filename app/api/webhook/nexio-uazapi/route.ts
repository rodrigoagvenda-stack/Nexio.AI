import { NextRequest, NextResponse } from 'next/server'
import { handleWebhook, resolveCompanyByInstance } from '@/lib/sdr/engine'
import type { UazapiWebhookMessage } from '@/lib/sdr/uazapi'

export const runtime = 'nodejs'
export const maxDuration = 10

// POST /api/webhook/nexio-uazapi — chat espelhado (mirror)
// Mesmo comportamento do /api/webhook/nexio — rota separada para
// permitir dois webhooks distintos na configuração da uazapi (mensagens + espelho).
export async function POST(request: NextRequest) {
  let body: UazapiWebhookMessage
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const instanceName = body.instanceName
  if (!instanceName) {
    return NextResponse.json({ error: 'instanceName ausente' }, { status: 400 })
  }

  const companyId = await resolveCompanyByInstance(instanceName)
  if (!companyId) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  handleWebhook(companyId, body).catch((err) => {
    console.error(`[Webhook Nexio-UAZapi] Erro empresa ${companyId}:`, err)
  })

  return NextResponse.json({ ok: true })
}
