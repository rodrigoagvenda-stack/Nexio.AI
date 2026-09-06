import { NextResponse } from 'next/server'
import { runReengageFila } from '@/lib/sdr/reengage-fila'
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
    const result = await runReengageFila()
    const ms = Date.now() - started
    if (result.processed > 0) {
      await syslog({
        type: 'reengage_fila',
        severity: 'info',
        message: `Reengajamento de fila concluído em ${ms}ms`,
        payload: result as unknown as Record<string, unknown>,
      })
    }
    return NextResponse.json({ ok: true, ...result })
  } catch (err: any) {
    console.error('[Cron reengage-fila]', err)
    await syslog({
      type: 'reengage_fila',
      severity: 'error',
      message: `reengage-fila cron falhou: ${err.message}`,
      payload: { error: err.message, stack: err.stack?.slice(0, 500) },
    })
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// GET /api/cron/reengage-fila : Vercel Cron
export const GET = handler
// POST /api/cron/reengage-fila : Supabase Edge Function relay (pg_cron)
export const POST = handler
