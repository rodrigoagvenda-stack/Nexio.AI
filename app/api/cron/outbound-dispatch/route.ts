import { NextResponse } from 'next/server'
import { runOutboundDispatch } from '@/lib/sdr/outbound'
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
  await syslog({ type: 'outbound', severity: 'info', message: 'Outbound dispatch cron iniciado' })

  try {
    const result = await runOutboundDispatch()
    const ms = Date.now() - started
    await syslog({
      type: 'outbound',
      severity: 'info',
      message: `Outbound dispatch concluído em ${ms}ms`,
      payload: result as unknown as Record<string, unknown>,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (err: any) {
    console.error('[Cron outbound-dispatch]', err)
    await syslog({
      type: 'outbound',
      severity: 'error',
      message: `Outbound dispatch cron falhou: ${err.message}`,
      payload: { error: err.message, stack: err.stack?.slice(0, 500) },
    })
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export const GET = handler   // Vercel Cron
export const POST = handler  // Supabase pg_cron relay
