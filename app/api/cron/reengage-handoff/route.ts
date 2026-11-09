import { NextResponse } from 'next/server'
import { runReengageHandoff } from '@/lib/sdr/reengage-handoff'
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
    const result = await runReengageHandoff()
    const ms = Date.now() - started
    if (result.processed > 0) {
      await syslog({
        type: 'reengage_handoff',
        severity: 'info',
        message: `Reengajamento de handoff concluído em ${ms}ms`,
        payload: result as unknown as Record<string, unknown>,
      })
    }
    return NextResponse.json({ ok: true, ...result })
  } catch (err: any) {
    console.error('[Cron reengage-handoff]', err)
    await syslog({
      type: 'reengage_handoff',
      severity: 'error',
      message: `reengage-handoff cron falhou: ${err.message}`,
      payload: { error: err.message, stack: err.stack?.slice(0, 500) },
    })
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// GET /api/cron/reengage-handoff : Vercel Cron
export const GET = handler
// POST /api/cron/reengage-handoff : Supabase Edge Function relay (pg_cron)
export const POST = handler
