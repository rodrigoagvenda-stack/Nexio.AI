/**
 * POST /api/webhooks/sequence/[companyId]/[sequenceId]
 *
 * Gatilho genérico "Evento de webhook" pra sequências de follow-up normais.
 * A URL já identifica a sequência exata (gerada no próprio canvas, aba
 * "Entrada automática por evento" > Evento de webhook), então qualquer
 * origem externa que souber o lead_id (ex: formulário Briefing) pode
 * disparar essa sequência colando essa URL no campo "Webhook" dela.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { runSequenceImmediateById } from '@/lib/sdr/follow'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ companyId: string; sequenceId: string }> }
) {
  const params = await props.params
  const companyId = Number(params.companyId)
  const sequenceId = params.sequenceId

  if (!companyId || !sequenceId) {
    return NextResponse.json({ success: false, message: 'companyId/sequenceId inválidos' }, { status: 400 })
  }

  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const rl = rateLimit({ key: `sequence-webhook:${companyId}:${ip}`, limit: 30, windowMs: 60_000 })
  if (!rl.success) return NextResponse.json({ success: false, message: 'Muitas requisições' }, { status: 429 })

  const body = await req.json().catch(() => null)
  const leadId = Number(body?.lead_id)
  if (!leadId) {
    return NextResponse.json({ success: false, message: 'Campo obrigatório: lead_id' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data: company } = await supabase.from('companies').select('id').eq('id', companyId).maybeSingle()
  if (!company) return NextResponse.json({ success: false, message: 'Empresa não encontrada' }, { status: 404 })

  runSequenceImmediateById(companyId, sequenceId, leadId)
    .then((r) => console.log(`[webhook-seq] company=${companyId} seq=${sequenceId} lead=${leadId} sent=${r.sent} error=${r.error ?? 'ok'}`))
    .catch((err) => console.error(`[webhook-seq] company=${companyId} seq=${sequenceId} lead=${leadId} falhou:`, err.message))

  return NextResponse.json({ success: true, message: 'Disparo iniciado' })
}
