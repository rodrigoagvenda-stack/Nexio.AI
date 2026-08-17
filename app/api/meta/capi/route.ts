import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { fireMetaCapiEvent } from '@/lib/meta/capi'

export const runtime = 'nodejs'

// POST /api/meta/capi : dispara manualmente um evento de conversão pro Pixel via Conversions API
export async function POST(req: NextRequest) {
  try {
    const { context, error: authError } = await requireAuth(req)
    if (authError) return authError

    const { conversaId, eventName = 'Purchase', value, currency = 'BRL' } = await req.json()
    if (!conversaId) {
      return NextResponse.json({ error: 'conversaId obrigatório' }, { status: 400 })
    }

    const supabase = createServiceClient()

    const { data: conversa } = await supabase
      .from('conversas_do_whatsapp')
      .select('numero_de_telefone')
      .eq('id', conversaId)
      .eq('company_id', context.companyId)
      .single()

    if (!conversa) {
      return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 })
    }

    const result = await fireMetaCapiEvent(supabase, {
      companyId: context.companyId,
      phone: conversa.numero_de_telefone,
      eventName,
      valueCents: value !== undefined ? Math.round(value * 100) : null,
      currency,
      eventIdSeed: `manual_${conversaId}`,
    })

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error, skipped: result.skipped }, { status: result.skipped ? 200 : 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('[CAPI] erro:', e)
    return NextResponse.json({ error: e?.message ?? 'Erro interno' }, { status: 500 })
  }
}
