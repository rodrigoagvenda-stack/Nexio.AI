import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { encrypt, decrypt } from '@/lib/crypto'

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('admin_users').select('id').eq('auth_user_id', user.id).eq('is_active', true).single()
  return data ? user : null
}

// GET /api/admin/sdr/:companyId — lê config SDR da empresa
export async function GET(
  _req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  try {
    const supabase = await createClient()
    if (!await requireAdmin(supabase)) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

    const service = createServiceClient()
    const { data: config } = await service
      .from('sdr_configs')
      .select('uazapi_instance_url, uazapi_instance_name, uazapi_token, openai_key, agente_ativo, instance_status, instance_phone')
      .eq('company_id', params.companyId)
      .single()

    return NextResponse.json({
      config: config ? {
        ...config,
        uazapi_token: config.uazapi_token ? '••••••••' : null,
        openai_key: config.openai_key ? '••••••••' : null,
        has_token: !!config.uazapi_token,
        has_openai: !!config.openai_key,
      } : null
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PUT /api/admin/sdr/:companyId — salva credenciais SDR da empresa
export async function PUT(
  request: NextRequest,
  { params }: { params: { companyId: string } }
) {
  try {
    const supabase = await createClient()
    if (!await requireAdmin(supabase)) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

    const body = await request.json()
    const { uazapi_instance_url, uazapi_instance_name, uazapi_token, openai_key } = body

    const service = createServiceClient()
    const companyId = parseInt(params.companyId)

    const { data: existing } = await service
      .from('sdr_configs')
      .select('id, uazapi_token, openai_key')
      .eq('company_id', companyId)
      .single()

    const updates: Record<string, any> = {
      company_id: companyId,
      webhook_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/sdr/webhook/${companyId}`,
    }

    if (uazapi_instance_url !== undefined) updates.uazapi_instance_url = uazapi_instance_url
    if (uazapi_instance_name !== undefined) updates.uazapi_instance_name = uazapi_instance_name

    // Só encripta e salva se for um novo token (não os bullets)
    if (uazapi_token && !uazapi_token.startsWith('••')) {
      updates.uazapi_token = encrypt(uazapi_token)
    }
    if (openai_key && !openai_key.startsWith('••')) {
      updates.openai_key = encrypt(openai_key)
    }

    if (existing) {
      await service.from('sdr_configs').update(updates).eq('id', existing.id)
    } else {
      await service.from('sdr_configs').insert(updates)
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
