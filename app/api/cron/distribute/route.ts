import { NextResponse } from 'next/server'
import { runDistributeAll } from '@/lib/sdr/distribute'
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
    const result = await runDistributeAll()
    const ms = Date.now() - started
    await syslog({
      type: 'distribute',
      severity: 'info',
      message: `Distribuição concluída em ${ms}ms`,
      payload: result as Record<string, unknown>,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (err: any) {
    console.error('[Cron distribute]', err)
    await syslog({
      type: 'distribute',
      severity: 'error',
      message: `Distribute cron falhou: ${err.message}`,
      payload: { error: err.message, stack: err.stack?.slice(0, 500) },
    })
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// GET /api/cron/distribute : Vercel Cron
export const GET = handler
// POST /api/cron/distribute : Supabase Edge Function relay
export const POST = handler
