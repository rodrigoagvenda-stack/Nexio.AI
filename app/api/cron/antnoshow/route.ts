import { NextResponse } from 'next/server'
import { runAntNoshowAll } from '@/lib/sdr/follow'

export const runtime = 'nodejs'
export const maxDuration = 300

function checkAuth(request: Request): boolean {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  return !!cronSecret && authHeader === `Bearer ${cronSecret}`
}

// GET /api/cron/antnoshow : Vercel Cron a cada 15 min
export async function GET(request: Request) {
  if (!checkAuth(request)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  try {
    const result = await runAntNoshowAll()
    return NextResponse.json({ ok: true, ...result })
  } catch (err: any) {
    console.error('[Cron antnoshow]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/cron/antnoshow : disparo manual (autenticação CRON_SECRET)
export async function POST(request: Request) {
  if (!checkAuth(request)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  try {
    const result = await runAntNoshowAll()
    return NextResponse.json({ ok: true, ...result })
  } catch (err: any) {
    console.error('[Cron antnoshow force]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
