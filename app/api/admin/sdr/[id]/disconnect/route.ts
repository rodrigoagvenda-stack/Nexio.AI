import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { createUazapiClient } from '@/lib/sdr/uazapi'
import { decrypt } from '@/lib/crypto'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAdmin(req)
  if (error) return error

  const supabase = createServiceClient()
  const { data: cfg } = await supabase
    .from('sdr_configs')
    .select('uazapi_instance_url, uazapi_token')
    .eq('company_id', params.id)
    .maybeSingle()

  if (!cfg?.uazapi_instance_url || !cfg?.uazapi_token) {
    return NextResponse.json({ error: 'SDR não configurado' }, { status: 400 })
  }

  try {
    const token = (() => { try { return decrypt(cfg.uazapi_token) } catch { return cfg.uazapi_token } })()
    const uazapi = createUazapiClient(cfg.uazapi_instance_url, token)
    await uazapi.disconnect()

    await supabase
      .from('sdr_configs')
      .update({ instance_status: 'disconnected', instance_phone: null })
      .eq('company_id', params.id)

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
