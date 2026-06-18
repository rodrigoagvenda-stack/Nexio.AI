import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { createServiceClient } from '@/lib/supabase/server'

const GTPRO_BASE = process.env.GTPRO_API_URL ?? 'https://api.vendai.pro'

// Mapeia FilterPeriod do Zaapply → date_preset do GTPRO
function toGtproPeriod(period: string): string {
  switch (period) {
    case 'today':  return 'today'
    case 'week':   return 'last_7d'
    case 'year':   return 'last_year'
    default:       return 'last_30d'  // month
  }
}

export async function GET(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const supabase = createServiceClient()

  const { data: cfg } = await supabase
    .from('sdr_configs')
    .select('gtpro_api_key')
    .eq('company_id', context.companyId)
    .maybeSingle()

  if (!cfg?.gtpro_api_key) {
    return NextResponse.json({ error: 'gtpro_not_connected' }, { status: 424 })
  }

  const { searchParams } = req.nextUrl
  const period = searchParams.get('period') ?? 'month'
  const since  = searchParams.get('since')
  const until  = searchParams.get('until')

  const gtproParams = new URLSearchParams({ date_preset: toGtproPeriod(period) })
  if (since && until && period === 'custom') {
    gtproParams.set('since', since)
    gtproParams.set('until', until)
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12_000) // 12 s timeout

    const res = await fetch(`${GTPRO_BASE}/api/attribution?${gtproParams}`, {
      headers: { Authorization: `Bearer ${cfg.gtpro_api_key}` },
      signal: controller.signal,
      cache: 'no-store',
    }).finally(() => clearTimeout(timeout))

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      return NextResponse.json(body, { status: res.status })
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (err: any) {
    const isTimeout = err?.name === 'AbortError'
    return NextResponse.json(
      { error: isTimeout ? 'timeout ao conectar com GTPRO' : err.message },
      { status: isTimeout ? 504 : 502 },
    )
  }
}
