import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

export const dynamic = 'force-dynamic'

// Resumo da sequência no cabeçalho do canvas: envios e leads alcançados nos últimos 30 dias.
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const { context, error: authError } = await requireAuth(request)
  if (authError) return authError

  try {
    const service = createServiceClient()
    const { data: seq } = await service
      .from('follow_sequences')
      .select('id')
      .eq('id', params.id)
      .eq('company_id', context.companyId)
      .maybeSingle()
    if (!seq) return NextResponse.json({ error: 'Sequência não encontrada' }, { status: 404 })

    const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
    const { data, error } = await service
      .from('follow_executions')
      .select('lead_id')
      .eq('sequence_id', params.id)
      .eq('company_id', context.companyId)
      .eq('status', 'sent')
      .gte('disparado_em', since)
      .limit(20000)
    if (error) throw error

    const rows = data ?? []
    return NextResponse.json({
      sent30: rows.length,
      leads30: new Set(rows.map((r) => r.lead_id).filter((id) => id != null)).size,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
