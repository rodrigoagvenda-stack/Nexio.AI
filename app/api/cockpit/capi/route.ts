import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { cockpitCompanyId } from '@/lib/cockpit-bridge'
import { fireMetaCapiEvent } from '@/lib/meta/capi'

/**
 * Ponte do Cockpit: venda fechada no quadro do Cockpit vira evento de compra (Purchase) na API de Conversoes da Meta,
 * pelo mesmo disparo do Zaapply (pixel, token e conta do WhatsApp Business da empresa, ctwa_clid da conversa).
 * eventIdSeed = id do card no Cockpit, pra Meta nao contar a mesma venda duas vezes.
 */
export async function POST(req: NextRequest) {
  const companyId = cockpitCompanyId(req)
  if (!companyId) return NextResponse.json({ ok: false, error: 'Não autorizado' }, { status: 401 })
  try {
    const { phone, valueCents, eventIdSeed, eventTime } = await req.json()
    const digits = String(phone ?? '').replace(/\D/g, '')
    if (digits.length < 10 || !eventIdSeed) return NextResponse.json({ ok: false, error: 'Dados faltando' }, { status: 400 })
    const r = await fireMetaCapiEvent(createServiceClient(), {
      companyId,
      phone: digits,
      eventName: 'Purchase',
      valueCents: Number.isFinite(Number(valueCents)) && Number(valueCents) > 0 ? Math.round(Number(valueCents)) : null,
      eventIdSeed: `cockpit_${String(eventIdSeed)}`,
      eventTime: Number.isFinite(Number(eventTime)) ? Number(eventTime) : undefined,
    })
    return NextResponse.json(r, { status: r.ok ? 200 : 422 })
  } catch (e: any) {
    console.error('[cockpit/capi]', e)
    return NextResponse.json({ ok: false, error: e?.message || 'Falha ao enviar' }, { status: 500 })
  }
}
