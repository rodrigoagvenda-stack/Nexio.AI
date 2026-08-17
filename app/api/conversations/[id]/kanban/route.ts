// Move conversa no Kanban + dispara Conversions API quando fecha
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { fireMetaCapiEvent } from '@/lib/meta/capi'

const VALID_STAGES = ['novo', 'qualificacao', 'fila', 'em_atendimento', 'negociacao', 'fechado']

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const body = await req.json()
  const { stage, value_cents, value_product_type } = body

  if (!stage || !VALID_STAGES.includes(stage)) {
    return NextResponse.json({ error: `stage inválido. Válidos: ${VALID_STAGES.join(', ')}` }, { status: 400 })
  }

  // RF6.7: mover para fechado exige value_cents
  if (stage === 'fechado' && (!value_cents || typeof value_cents !== 'number' || value_cents <= 0)) {
    return NextResponse.json(
      { error: 'Valor de conversão obrigatório para fechar a conversa', code: 'MISSING_VALUE' },
      { status: 422 }
    )
  }

  const supabase = createServiceClient()
  const convId = Number(params.id)
  const now = new Date().toISOString()

  const update: Record<string, unknown> = {
    kanban_stage: stage,
  }
  if (stage === 'fila') update.queue_entered_at = now
  if (stage === 'fechado') {
    update.current_status = 'fechada'
    update.value_cents = value_cents
    update.value_filled_at = now
    update.value_product_type = value_product_type ?? 'variavel'
  }

  const { data: conv, error: updateErr } = await supabase
    .from('conversas_do_whatsapp')
    .update(update)
    .eq('id', convId)
    .eq('company_id', context.companyId)
    .select('id, numero_de_telefone, ctwa_clid, attribution_source')
    .single()

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })
  if (!conv) return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 })

  // Salva conversion_values
  if (stage === 'fechado') {
    await supabase
      .from('conversion_values')
      .upsert(
        { conversation_id: convId, value_cents, product_type: value_product_type ?? 'variavel', filled_at: now },
        { onConflict: 'conversation_id' }
      )

    // Dispara Conversions API Meta em background (mesmo helper usado pelo
    // fechamento no Kanban de leads, ver lib/meta/capi.ts)
    fireMetaCapiEvent(supabase, {
      companyId: context.companyId,
      phone: conv.numero_de_telefone,
      valueCents: value_cents,
      eventIdSeed: `conv_${convId}`,
    }).catch((e) => console.warn('[conversions-kanban] falha ao disparar CAPI:', e?.message))
  }

  return NextResponse.json({ ok: true, stage, conv_id: convId })
}
