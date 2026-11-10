import { NextResponse } from 'next/server'
import { runReengageOpenaiCredits } from '@/lib/sdr/reengage-openai-credits'
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
    const result = await runReengageOpenaiCredits()
    const ms = Date.now() - started
    if (result.processed > 0) {
      await syslog({
        type: 'reengage_openai_credits',
        severity: 'info',
        message: `Reengajamento pós OpenAI-sem-crédito concluído em ${ms}ms`,
        payload: result as unknown as Record<string, unknown>,
      })
    }
    return NextResponse.json({ ok: true, ...result })
  } catch (err: any) {
    console.error('[Cron reengage-openai-credits]', err)
    await syslog({
      type: 'reengage_openai_credits',
      severity: 'error',
      message: `reengage-openai-credits cron falhou: ${err.message}`,
      payload: { error: err.message, stack: err.stack?.slice(0, 500) },
    })
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// GET /api/cron/reengage-openai-credits : Vercel Cron
export const GET = handler
// POST /api/cron/reengage-openai-credits : Supabase Edge Function relay (pg_cron)
export const POST = handler
