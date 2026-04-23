import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/crypto'
import { createUazapiClient } from '@/lib/sdr/uazapi'

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('admin_users').select('id').eq('auth_user_id', user.id).eq('is_active', true).single()
  return data ? user : null
}

// POST /api/admin/sdr/:companyId/disconnect
export async function POST(
  _req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  try {
    const supabase = await createClient()
    if (!await requireAdmin(supabase)) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

    const service = createServiceClient()
    const { data: config } = await service
      .from('sdr_configs')
      .select('uazapi_instance_url, uazapi_token')
      .eq('company_id', params.companyId)
      .single()

    if (!config?.uazapi_token || !config?.uazapi_instance_url) {
      return NextResponse.json({ error: 'Config não encontrada' }, { status: 404 })
    }

    const token = decrypt(config.uazapi_token)
    const client = createUazapiClient(config.uazapi_instance_url, token)
    await client.disconnect()

    await service
      .from('sdr_configs')
      .update({ instance_status: 'disconnected', instance_phone: null })
      .eq('company_id', params.companyId)

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
