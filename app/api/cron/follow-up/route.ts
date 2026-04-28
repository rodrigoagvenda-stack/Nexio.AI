import { NextResponse } from 'next/server'
import { runFollowUp } from '@/lib/sdr/follow'

export const runtime = 'nodejs'
export const maxDuration = 300

// GET /api/cron/follow-up — chamado pelo Vercel Cron (ou trigger externo)
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const result = await runFollowUp()
    return NextResponse.json({ ok: true, ...result })
  } catch (err: any) {
    console.error('[Cron follow-up]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
