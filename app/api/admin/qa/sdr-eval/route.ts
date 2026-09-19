import { NextRequest, NextResponse } from 'next/server'
import { runSdrEval } from '@/lib/sdr/eval'
import { requireAdmin } from '@/lib/auth/require-auth'

export const runtime = 'nodejs'
export const maxDuration = 300

// POST /api/admin/qa/sdr-eval : roda o harness de avaliação do SDR
// (lib/sdr/eval.ts) contra a empresa-sombra da empresa indicada, em produção,
// onde a service role key já existe. Body: { companyId, deep?, repeat?, only? }.
// Nunca toca em dado real, só na empresa-sombra clonada.
// Auth : admin da plataforma logado (página /admin/qa-sdr, sem segredo nenhum
// no navegador) OU Authorization Bearer CRON_SECRET (scripts).
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const viaSecret = !!cronSecret && authHeader === `Bearer ${cronSecret}`
  if (!viaSecret) {
    const { error } = await requireAdmin(request)
    if (error) return error
  }

  try {
    const body = await request.json().catch(() => ({}))
    const companyId = Number(body?.companyId ?? 30)
    const only = Array.isArray(body?.only) ? body.only.map(Number).filter(Number.isInteger) : undefined
    const result = await runSdrEval(companyId, {
      deep: body?.deep === true,
      repeat: body?.repeat ? Number(body.repeat) : 1,
      only,
    })
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[api/admin/qa/sdr-eval]', err)
    return NextResponse.json({ error: err?.message ?? 'Erro interno' }, { status: 500 })
  }
}
