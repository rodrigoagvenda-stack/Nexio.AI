import { NextRequest, NextResponse } from 'next/server'
import { runV3CalendarRealTest } from '@/lib/sdr/v3/calendar-real-test'
import { requireAdmin } from '@/lib/auth/require-auth'

export const runtime = 'nodejs'
export const maxDuration = 300

// POST /api/admin/qa/sdr-v3-calendar-real : roda os 3 cenários de "reunião marcada" (imprevisto, novo
// horário direto, ligação) contra o Google Calendar REAL da empresa (cria e cancela evento de verdade).
// Diferente de sdr-v3-live: aqui a agenda de verdade é tocada. Cria um lead de teste isolado (nome
// "TESTE CLAUDE (apagar)") e apaga tudo (lead, conversa, evento) no final, sucesso ou falha.
// Auth: admin da plataforma logado (página /admin/sdr-v3-teste).
export async function POST(request: NextRequest) {
  const { error } = await requireAdmin(request)
  if (error) return error

  try {
    const body = await request.json().catch(() => ({}))
    const companyId = Number(body?.companyId ?? 30)
    const result = await runV3CalendarRealTest(companyId)
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[api/admin/qa/sdr-v3-calendar-real]', err)
    return NextResponse.json({ error: err?.message ?? 'Erro interno' }, { status: 500 })
  }
}
