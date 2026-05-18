import { NextResponse } from 'next/server'
import { runAntNoshow } from '@/lib/sdr/follow-antnoshow'

export const runtime = 'nodejs'
export const maxDuration = 300

// GET /api/cron/antnoshow — chamado pelo Vercel Cron ou trigger externo a cada 15 min
// vercel.json: { "crons": [{ "path": "/api/cron/antnoshow", "schedule": "*/15 * * * *" }] }
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const result = await runAntNoshow()
    return NextResponse.json({ ok: true, ...result })
  } catch (err: any) {
    console.error('[Cron antnoshow]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
