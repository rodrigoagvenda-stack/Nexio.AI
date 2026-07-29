import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require-auth'
import { createUazapiClient } from '@/lib/sdr/uazapi'

/**
 * POST /api/admin/fix-webhooks
 * Reconfigura o webhook de TODAS as instâncias ativas com a URL correta (incluindo secret).
 * Útil quando o NEXIO_WEBHOOK_SECRET mudou ou instâncias foram criadas sem o secret.
 */
export async function POST(request: NextRequest) {
  const { error: authError } = await requireAdmin(request)
  if (authError) return authError

  const service = createServiceClient()
  const webhookSecret = process.env.NEXIO_WEBHOOK_SECRET
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.zaapply.com.br'
  const webhookUrl = `${baseUrl}/api/webhook/nexio${webhookSecret ? `?secret=${webhookSecret}` : ''}`

  const { data: configs } = await service
    .from('sdr_configs')
    .select('company_id, uazapi_instance_url, uazapi_token, uazapi_instance_name')
    .not('uazapi_token', 'is', null)
    .not('uazapi_instance_url', 'is', null)

  const results: { company_id: number; ok: boolean; error?: string }[] = []

  for (const cfg of configs ?? []) {
    try {
      let token = cfg.uazapi_token
      if (token.includes(':') && token.split(':').length === 3) {
        try {
          const { decrypt } = await import('@/lib/crypto')
          token = decrypt(token)
        } catch { /* token legado inválido : pula */ }
      }

      const client = createUazapiClient(cfg.uazapi_instance_url, token)
      await client.setWebhook(webhookUrl)
      console.log(`[fix-webhooks] empresa=${cfg.company_id} instancia=${cfg.uazapi_instance_name} OK`)
      results.push({ company_id: cfg.company_id, ok: true })
    } catch (err: any) {
      console.error(`[fix-webhooks] empresa=${cfg.company_id} ERRO:`, err.message)
      results.push({ company_id: cfg.company_id, ok: false, error: err.message })
    }
  }

  const ok = results.filter(r => r.ok).length
  const failed = results.filter(r => !r.ok).length
  return NextResponse.json({ total: results.length, ok, failed, results })
}
