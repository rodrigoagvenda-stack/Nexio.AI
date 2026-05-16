import { NextRequest, NextResponse } from 'next/server'
import { handleWebhook, resolveCompanyByInstance } from '@/lib/sdr/engine'
import { writeSystemLog } from '@/lib/system-log'
import type { UazapiWebhookMessage } from '@/lib/sdr/uazapi'

export const runtime = 'nodejs'
export const maxDuration = 10

// POST /api/webhook/nexio — webhook principal da uazapi
// company_id é resolvido pelo instanceName (campo companies.whatsapp_instance_name)
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
    // Instância não mapeada — aceita silenciosamente para não gerar ruído no log da uazapi
    return NextResponse.json({ ok: true, skipped: true })
  }

  handleWebhook(companyId, body).catch((err) => {
    console.error(`[Webhook Nexio] Erro empresa ${companyId}:`, err)
    writeSystemLog('webhook', 'error', companyId, `Erro no webhook: ${err?.message ?? 'Erro desconhecido'}`, { instanceName }, err?.stack?.slice(0, 1000))
  })

  return NextResponse.json({ ok: true })
}
