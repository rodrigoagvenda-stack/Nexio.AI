import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { rateLimit } from '@/lib/rate-limit'
import { runTenantSelfTest } from '@/lib/sdr/eval'

export const runtime = 'nodejs'
export const maxDuration = 120

// POST /api/sdr/self-test : o próprio cliente testa o SDR configurado por
// ELE, contra o motor real (processSdrMessage), numa empresa-sombra isolada
// (lib/sdr/qa-shadow.ts) que espelha o wizard atual sem tocar em lead/
// conversa real nenhuma. Resultado em português simples, não log técnico.
export async function POST(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request)
  if (authError) return authError

  const rl = rateLimit({ key: `sdr:self-test:${context.companyId}`, limit: 10, windowMs: 60 * 60_000 })
  if (!rl.success) {
    return NextResponse.json({ error: 'Limite de testes atingido. Tente novamente em 1 hora.' }, { status: 429 })
  }

  try {
    const result = await runTenantSelfTest(context.companyId)
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[api/sdr/self-test]', err)
    return NextResponse.json({ error: err?.message ?? 'Erro ao testar o SDR' }, { status: 500 })
  }
}
