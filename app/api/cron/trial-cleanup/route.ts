import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createUazapiClient } from '@/lib/sdr/uazapi'
import { decrypt } from '@/lib/crypto'

export const dynamic = 'force-dynamic'

const GRACE_DAYS = 5
const PAID_PLAN_TYPES = ['starter', 'start', 'pro', 'growth', 'scale']

/**
 * GET /api/cron/trial-cleanup
 * Desconecta instâncias uazapi de empresas cujo trial expirou há mais de GRACE_DAYS dias.
 * Configurar no Easypanel:
 *   URL: https://seu-dominio.com/api/cron/trial-cleanup
 *   Method: GET
 *   Header: Authorization: Bearer CRON_SECRET
 *   Intervalo: 1x por dia
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const expectedToken = process.env.CRON_SECRET

  if (!expectedToken) {
    return NextResponse.json({ error: 'CRON_SECRET não configurado' }, { status: 500 })
  }
  if (authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  const cutoffDate = new Date(Date.now() - GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString()

  // Empresas com trial vencido há mais de GRACE_DAYS e sem plano pago
  const { data: companies, error: compErr } = await supabase
    .from('companies')
    .select('id, name, plan_type, trial_ends_at, subscription_expires_at')
    .not('plan_type', 'in', `(${PAID_PLAN_TYPES.join(',')})`)
    .or(`trial_ends_at.lt.${cutoffDate},subscription_expires_at.lt.${cutoffDate}`)

  if (compErr) {
    return NextResponse.json({ error: compErr.message }, { status: 500 })
  }

  if (!companies?.length) {
    return NextResponse.json({ ok: true, disconnected: 0, message: 'Nenhuma empresa a desconectar.' })
  }

  const companyIds = companies.map((c) => c.id)

  // Busca sdr_configs das empresas com instância ainda conectada
  const { data: configs, error: cfgErr } = await supabase
    .from('sdr_configs')
    .select('company_id, uazapi_instance_url, uazapi_token, instance_status')
    .in('company_id', companyIds)
    .neq('instance_status', 'disconnected')

  if (cfgErr) {
    return NextResponse.json({ error: cfgErr.message }, { status: 500 })
  }

  const results: { company_id: number; status: string; error?: string }[] = []

  for (const cfg of configs ?? []) {
    if (!cfg.uazapi_instance_url || !cfg.uazapi_token) {
      results.push({ company_id: cfg.company_id, status: 'skipped_no_config' })
      continue
    }

    try {
      const token = (() => { try { return decrypt(cfg.uazapi_token) } catch { return cfg.uazapi_token } })()
      const uazapi = createUazapiClient(cfg.uazapi_instance_url, token)
      await uazapi.disconnect()

      await supabase
        .from('sdr_configs')
        .update({ instance_status: 'disconnected', instance_phone: null })
        .eq('company_id', cfg.company_id)

      results.push({ company_id: cfg.company_id, status: 'disconnected' })
    } catch (err: any) {
      // Falha ao desconectar não bloqueia as demais — marca no banco de qualquer forma
      await supabase
        .from('sdr_configs')
        .update({ instance_status: 'disconnected', instance_phone: null })
        .eq('company_id', cfg.company_id)

      results.push({ company_id: cfg.company_id, status: 'force_disconnected', error: err.message })
    }
  }

  const disconnected = results.filter((r) => r.status.includes('disconnected')).length

  return NextResponse.json({
    ok: true,
    grace_days: GRACE_DAYS,
    cutoff: cutoffDate,
    candidates: companies.length,
    disconnected,
    results,
  })
}
