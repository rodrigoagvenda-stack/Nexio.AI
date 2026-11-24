import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { cockpitCompanyId } from '@/lib/cockpit-bridge'
import { listBusy } from '@/lib/google-calendar'

/** Ponte do Cockpit: horarios ocupados no Google Agenda da empresa (so leitura, freebusy). */
export async function POST(req: NextRequest) {
  const companyId = cockpitCompanyId(req)
  if (!companyId) return NextResponse.json({ ok: false, error: 'Não autorizado' }, { status: 401 })
  try {
    const { start, end } = await req.json()
    const s = new Date(start), e = new Date(end)
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e <= s || e.getTime() - s.getTime() > 45 * 86400000) {
      return NextResponse.json({ ok: false, error: 'Período inválido' }, { status: 400 })
    }
    const { data: cfg } = await createServiceClient().from('sdr_configs').select('google_calendar_id').eq('company_id', companyId).maybeSingle()
    if (!cfg?.google_calendar_id) return NextResponse.json({ ok: true, busy: [] })
    const busy = await listBusy(companyId, cfg.google_calendar_id, s, e)
    return NextResponse.json({ ok: true, busy })
  } catch (e: any) {
    console.error('[cockpit/busy]', e)
    return NextResponse.json({ ok: false, error: e?.message || 'Falha' }, { status: 500 })
  }
}
