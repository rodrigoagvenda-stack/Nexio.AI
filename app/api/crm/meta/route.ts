import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { createServiceClient } from '@/lib/supabase/server'

const GTPRO_BASE = process.env.GTPRO_API_URL ?? 'https://gtpro.vendai.pro'

function toGtproPeriod(period: string): string {
  switch (period) {
    case 'today': return 'today'
    case 'week':  return 'last_7d'
    case 'year':  return 'last_year'
    default:      return 'last_30d'
  }
}

function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message || err.constructor.name
  return String(err)
}

export async function GET(req: NextRequest) {
  try {
    const { context, error: authError } = await requireAuth(req)
    if (authError) return authError

    const supabase = createServiceClient()

    const { data: cfg, error: dbErr } = await supabase
      .from('sdr_configs')
      .select('gtpro_api_key')
      .eq('company_id', context.companyId)
      .maybeSingle()

    if (dbErr) {
      return NextResponse.json({ error: `db: ${dbErr.message}` }, { status: 500 })
    }

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

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 12_000)

    let gtproRes: Response
    try {
      gtproRes = await fetch(`${GTPRO_BASE}/api/attribution?${gtproParams}`, {
        headers: { Authorization: `Bearer ${cfg.gtpro_api_key}` },
        signal: controller.signal,
        cache: 'no-store',
      })
    } catch (fetchErr) {
      const isTimeout = (fetchErr as any)?.name === 'AbortError'
      return NextResponse.json(
        { error: isTimeout ? 'timeout (GTPRO sem resposta)' : `fetch: ${errMsg(fetchErr)}` },
        { status: isTimeout ? 504 : 502 },
      )
    } finally {
      clearTimeout(timer)
    }

    if (!gtproRes.ok) {
      const body = await gtproRes.json().catch(() => ({}))
      return NextResponse.json(
        { error: body?.error ?? `GTPRO ${gtproRes.status}` },
        { status: gtproRes.status },
      )
    }

    const data = await gtproRes.json()
    return NextResponse.json(data)

  } catch (err) {
    return NextResponse.json({ error: `proxy crash: ${errMsg(err)}` }, { status: 500 })
  }
}
