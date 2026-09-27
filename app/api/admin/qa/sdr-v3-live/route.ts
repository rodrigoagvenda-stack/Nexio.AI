import { NextRequest, NextResponse } from 'next/server'
import { runV3LiveSelfTest } from '@/lib/sdr/v3/self-test-live'
import { requireAdmin } from '@/lib/auth/require-auth'

export const runtime = 'nodejs'
export const maxDuration = 300

// POST /api/admin/qa/sdr-v3-live : roda os cenários da auditoria de 27/09/2026 (lib/sdr/v3/self-test-live.ts)
// contra o modelo de verdade (gpt-4.1), com a config REAL e ativa da empresa. Não cria lead, não grava
// sdr_conversation_state nem sdr_turn_log, não manda WhatsApp. Body: { companyId? } (padrão 30).
// Auth: admin da plataforma logado (página /admin/sdr-v3-teste, sem segredo nenhum no navegador).
export async function POST(request: NextRequest) {
  const { error } = await requireAdmin(request)
  if (error) return error

  try {
    const body = await request.json().catch(() => ({}))
    const companyId = Number(body?.companyId ?? 30)
    const result = await runV3LiveSelfTest(companyId)
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[api/admin/qa/sdr-v3-live]', err)
    return NextResponse.json({ error: err?.message ?? 'Erro interno' }, { status: 500 })
  }
}
