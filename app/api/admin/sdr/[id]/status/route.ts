import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { createUazapiClient } from '@/lib/sdr/uazapi'
import { decrypt } from '@/lib/crypto'

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { error } = await requireAdmin(req)
  if (error) return error

  const supabase = createServiceClient()
  const { data: cfg } = await supabase
    .from('sdr_configs')
    .select('uazapi_instance_url, uazapi_token')
    .eq('company_id', params.id)
    .maybeSingle()

  if (!cfg?.uazapi_instance_url || !cfg?.uazapi_token) {
    return NextResponse.json({ status: 'disconnected', phone: null })
  }

  try {
    const token = (() => { try { return decrypt(cfg.uazapi_token) } catch { return cfg.uazapi_token } })()
    const uazapi = createUazapiClient(cfg.uazapi_instance_url, token)
    const result = await uazapi.getStatus()

    await supabase
      .from('sdr_configs')
      .update({ instance_status: result.status, instance_phone: result.phone ?? null })
      .eq('company_id', params.id)

    return NextResponse.json({ status: result.status, phone: result.phone ?? null })
  } catch (err: any) {
    return NextResponse.json({ status: 'disconnected', phone: null, error: err.message })
  }
}
