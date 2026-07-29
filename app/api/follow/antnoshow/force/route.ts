import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { runAntNoshowForCompany } from '@/lib/sdr/follow'

export const runtime = 'nodejs'
export const maxDuration = 300

// POST /api/follow/antnoshow/force
// Força o anti-noshow usando 100% os nodes do canvas, ignorando janela de tempo.
// Body: { horasAlvo?: number } : se informado, filtra steps com dia_offset próximo desse valor.
//   Ex: -24 = nodes de 24h antes | -2 = 2h antes | -0.25 = 15min antes | 0.083 = 5min depois
export async function POST(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request)
  if (authError) return authError

  const body = await request.json().catch(() => ({}))
  const horasAlvo: number | undefined = typeof body.horasAlvo === 'number' ? body.horasAlvo : undefined

  try {
    const result = await runAntNoshowForCompany(context.companyId, { horasAlvo })
    return NextResponse.json({ ok: true, disparados: result.sent, error: result.error })
  } catch (err: any) {
    console.error('[antnoshow force]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
