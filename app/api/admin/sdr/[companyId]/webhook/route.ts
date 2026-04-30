import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createUazapiClient } from '@/lib/sdr/uazapi'
import { decrypt } from '@/lib/crypto'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params
  const supabase = createServiceClient()

  const { data: config } = await supabase
    .from('sdr_configs')
    .select('uazapi_instance_url, uazapi_token, uazapi_instance_name')
    .eq('company_id', companyId)
    .single()

  if (!config?.uazapi_token || !config?.uazapi_instance_url) {
    return NextResponse.json({ error: 'Instância não configurada' }, { status: 404 })
  }

  let token = config.uazapi_token
  if (token.includes(':') && token.split(':').length === 3) {
    try { token = decrypt(token) } catch { /* plain text */ }
  }

  try {
    const client = createUazapiClient(config.uazapi_instance_url, token)
    const webhook = await client.getWebhook()
    return NextResponse.json({ webhook, instanceName: config.uazapi_instance_name })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST — reconfigura webhook na instância
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params
  const supabase = createServiceClient()

  const { data: config } = await supabase
    .from('sdr_configs')
    .select('uazapi_instance_url, uazapi_token')
    .eq('company_id', companyId)
    .single()

  if (!config?.uazapi_token || !config?.uazapi_instance_url) {
    return NextResponse.json({ error: 'Instância não configurada' }, { status: 404 })
  }

  let token = config.uazapi_token
  if (token.includes(':') && token.split(':').length === 3) {
    try { token = decrypt(token) } catch { /* plain text */ }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const webhookUrl = `${appUrl}/api/sdr/webhook/${companyId}`

  try {
    const client = createUazapiClient(config.uazapi_instance_url, token)
    await client.setWebhook(webhookUrl)
    console.log(`[Admin] webhook reconfigurado para empresa ${companyId}: ${webhookUrl}`)
    return NextResponse.json({ ok: true, webhookUrl })
  } catch (err: any) {
    console.error(`[Admin] erro ao reconfigurar webhook empresa ${companyId}:`, err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
