import { NextResponse } from 'next/server'
import { runFollowUp } from '@/lib/sdr/follow'
import { syslog } from '@/lib/logger'

export const runtime = 'nodejs'
export const maxDuration = 300

// GET /api/cron/follow-up — chamado pelo Vercel Cron (ou trigger externo)
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const started = Date.now()
  await syslog({ type: 'follow_up', severity: 'info', message: 'Follow-up cron iniciado' })

  try {
    const result = await runFollowUp()
    const ms = Date.now() - started
    await syslog({
      type: 'follow_up',
      severity: 'info',
      message: `Follow-up concluído em ${ms}ms`,
      payload: result as Record<string, unknown>,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (err: any) {
    console.error('[Cron follow-up]', err)
    await syslog({
      type: 'follow_up',
      severity: 'error',
      message: `Follow-up cron falhou: ${err.message}`,
      payload: { error: err.message, stack: err.stack?.slice(0, 500) },
    })
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
