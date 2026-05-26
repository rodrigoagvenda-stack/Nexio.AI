import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { runAntNoshow } from '@/lib/sdr/follow-antnoshow'

export const runtime = 'nodejs'
export const maxDuration = 300

// POST /api/follow/antnoshow/force
// Força o cron anti-noshow para todos os leads com call agendada (ignora janela de tempo).
// Usa autenticação de sessão — sem necessidade de CRON_SECRET.
export async function POST(request: NextRequest) {
  const { error: authError } = await requireAuth(request)
  if (authError) return authError

  try {
    const result = await runAntNoshow({ force: true })
    return NextResponse.json({ ok: true, ...result })
  } catch (err: any) {
    console.error('[antnoshow force]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
