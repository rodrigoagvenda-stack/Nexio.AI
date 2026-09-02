import { NextRequest, NextResponse } from 'next/server'
import { runSdrEval } from '@/lib/sdr/eval'

export const runtime = 'nodejs'
export const maxDuration = 120

// POST /api/admin/qa/sdr-eval : roda o harness de avaliação do SDR
// (lib/sdr/eval.ts) contra a empresa de QA isolada (id 31), em produção,
// onde a service role key já existe. Mesma auth dos crons : Authorization
// Bearer CRON_SECRET. Nunca toca em empresa real.
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const result = await runSdrEval()
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[api/admin/qa/sdr-eval]', err)
    return NextResponse.json({ error: err?.message ?? 'Erro interno' }, { status: 500 })
  }
}
