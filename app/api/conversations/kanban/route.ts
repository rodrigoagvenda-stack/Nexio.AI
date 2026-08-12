// Retorna conversas agrupadas por kanban_stage para o Kanban de conversas WA
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

const STAGES = ['novo', 'qualificacao', 'fila', 'em_atendimento', 'negociacao', 'fechado']

export async function GET(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('conversas_do_whatsapp')
    .select(`
      id,
      numero_de_telefone,
      nome_do_contato,
      ultima_mensagem,
      hora_da_ultima_mensagem,
      status_da_conversa,
      kanban_stage,
      current_status,
      queue_entered_at,
      briefing,
      value_cents,
      ctwa_clid,
      attribution_source,
      current_attendant_id,
      wa_number_id,
      created_at
    `)
    .eq('company_id', context.companyId)
    .order('hora_da_ultima_mensagem', { ascending: false })
    .limit(500)

  if (error) {
    // Se coluna não existe ainda (migration pendente), retorna vazio
    if (error.message?.includes('column') || error.message?.includes('does not exist')) {
      return NextResponse.json({ conversations: [], stages: STAGES, migration_pending: true })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Agrupar por kanban_stage (default: 'novo' para quem não tem)
  const byStage: Record<string, any[]> = {}
  for (const stage of STAGES) byStage[stage] = []

  for (const conv of (data ?? [])) {
    const stage = conv.kanban_stage ?? 'novo'
    if (byStage[stage]) {
      byStage[stage].push(conv)
    } else {
      byStage['novo'].push(conv)
    }
  }

  return NextResponse.json({
    conversations: data,
    byStage,
    stages: STAGES,
    total: data?.length ?? 0,
  })
}
