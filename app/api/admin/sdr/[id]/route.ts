import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { encrypt, decrypt } from '@/lib/crypto'

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { error } = await requireAdmin(req)
  if (error) return error

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('sdr_configs')
    .select('uazapi_instance_url, uazapi_instance_name, uazapi_token, openai_key, instance_status, instance_phone')
    .eq('company_id', params.id)
    .maybeSingle()

  if (!data) return NextResponse.json({ config: null })

  return NextResponse.json({
    config: {
      uazapi_instance_url: data.uazapi_instance_url ?? '',
      uazapi_instance_name: data.uazapi_instance_name ?? '',
      has_token: !!data.uazapi_token,
      has_openai: !!data.openai_key,
      instance_status: data.instance_status ?? 'disconnected',
      instance_phone: data.instance_phone ?? null,
    },
  })
}

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { error } = await requireAdmin(req)
  if (error) return error

  const body = await req.json()
  const supabase = createServiceClient()

  const update: Record<string, string> = {
    uazapi_instance_url: body.uazapi_instance_url ?? '',
    uazapi_instance_name: body.uazapi_instance_name ?? '',
  }
  if (body.uazapi_token) update.uazapi_token = encrypt(body.uazapi_token)
  if (body.openai_key) update.openai_key = encrypt(body.openai_key)

  const { error: dbErr } = await supabase
    .from('sdr_configs')
    .upsert({ company_id: Number(params.id), ...update }, { onConflict: 'company_id' })

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  // resolveCompanyByInstance() (webhook do uazapi, app/api/webhook/nexio)
  // identifica a empresa da mensagem por companies.whatsapp_instance_name,
  // não por sdr_configs.uazapi_instance_name : sem sincronizar os dois,
  // mensagem inbound é descartada silenciosamente (200 ok, sem erro em
  // lugar nenhum). Achado ao vivo com 3 empresas desincronizadas.
  if (body.uazapi_instance_name) {
    await supabase
      .from('companies')
      .update({ whatsapp_instance_name: body.uazapi_instance_name })
      .eq('id', Number(params.id))
  }

  return NextResponse.json({ ok: true })
}
