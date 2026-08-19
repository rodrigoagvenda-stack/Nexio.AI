import { NextResponse } from 'next/server'
import { runMetaAdsSync } from '@/lib/sdr/meta-ads-sync'
import { syslog } from '@/lib/logger'

export const runtime = 'nodejs'
export const maxDuration = 300

async function handler(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const started = Date.now()
  try {
    const result = await runMetaAdsSync()
    const ms = Date.now() - started
    await syslog({
      type: 'meta_ads_sync',
      severity: 'info',
      message: `Sync de gasto Meta Ads concluído em ${ms}ms`,
      payload: result as Record<string, unknown>,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (err: any) {
    console.error('[Cron meta-ads-sync]', err)
    await syslog({
      type: 'meta_ads_sync',
      severity: 'error',
      message: `meta-ads-sync cron falhou: ${err.message}`,
      payload: { error: err.message, stack: err.stack?.slice(0, 500) },
    })
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// GET /api/cron/meta-ads-sync : Vercel Cron
export const GET = handler
// POST /api/cron/meta-ads-sync : Supabase Edge Function relay
export const POST = handler
