// Move conversa no Kanban + dispara Conversions API quando fecha
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'
import crypto from 'crypto'

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

    // Dispara Conversions API Meta em background
    fireMetaConversionsApi(supabase, convId, conv.numero_de_telefone, conv.ctwa_clid, value_cents, context.companyId)
  }

  return NextResponse.json({ ok: true, stage, conv_id: convId })
}

async function fireMetaConversionsApi(
  supabase: ReturnType<typeof createServiceClient>,
  convId: number,
  phone: string,
  ctwaClid: string | null,
  valueCents: number,
  companyId: number
) {
  try {
    // Busca pixel config
    const { data: cfg } = await supabase
      .from('sdr_configs')
      .select('meta_pixel_id, meta_pixel_token')
      .eq('company_id', companyId)
      .maybeSingle()

    if (!cfg?.meta_pixel_id || !cfg?.meta_pixel_token) {
      console.log('[conversions-api] pixel não configurado — pulando disparo')
      return
    }

    // Hasheia telefone (SHA-256 sem formatação)
    const cleanPhone = phone.replace(/\D/g, '')
    const hashedPhone = crypto.createHash('sha256').update(cleanPhone).digest('hex')

    const eventTime = Math.floor(Date.now() / 1000)
    const payload = {
      data: [
        {
          event_name: 'Purchase',
          event_time: eventTime,
          action_source: 'other',
          user_data: {
            ph: [hashedPhone],
          },
          custom_data: {
            value: valueCents / 100,
            currency: 'BRL',
          },
          ...(ctwaClid ? { attribution_data: { attribution_share: '1', attribution_model: 'last_touch', ctwa_clid: ctwaClid } } : {}),
        },
      ],
    }

    const res = await fetch(
      `https://graph.facebook.com/v21.0/${cfg.meta_pixel_id}/events?access_token=${cfg.meta_pixel_token}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
    )
    const responseBody = await res.json()

    await supabase.from('conversions_api_log').insert({
      conversation_id: convId,
      payload_sent: payload,
      response_status: res.status,
      response_body: responseBody,
      attempt_number: 1,
      success: res.ok,
    })

    console.log(`[conversions-api] disparo : convId=${convId} status=${res.status} ok=${res.ok}`)
  } catch (err: any) {
    console.error(`[conversions-api] erro no disparo : convId=${convId} : ${err.message}`)
    await supabase.from('conversions_api_log').insert({
      conversation_id: convId,
      payload_sent: {},
      response_status: 0,
      response_body: { error: err.message },
      attempt_number: 1,
      success: false,
    })
  }
}
