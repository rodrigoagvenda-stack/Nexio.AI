import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/crypto'
import { createUazapiClient } from '@/lib/sdr/uazapi'

// POST /api/sdr/connect
// Body: { phone?: string }  — phone opcional (se informado, usa pairing code; senão, QR code)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data: userData } = await supabase
      .from('users')
      .select('company_id, role')
      .eq('auth_user_id', user.id)
      .single()

    if (!userData) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    const service = createServiceClient()
    const { data: config } = await service
      .from('sdr_configs')
      .select('uazapi_instance_url, uazapi_token')
      .eq('company_id', userData.company_id)
      .single()

    if (!config?.uazapi_token || !config?.uazapi_instance_url) {
      return NextResponse.json(
        { error: 'Configure a URL e o token da instância antes de conectar' },
        { status: 400 }
      )
    }

    const token = decrypt(config.uazapi_token)
    const client = createUazapiClient(config.uazapi_instance_url, token)

    const body = await request.json().catch(() => ({}))
    const result = await client.connect(body.phone)

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[SDR connect]', err)
    return NextResponse.json({ error: err.message || 'Erro ao conectar' }, { status: 500 })
  }
}

// DELETE /api/sdr/connect — desconecta a instância WhatsApp
export async function DELETE() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data: userData } = await supabase
      .from('users')
      .select('company_id, role')
      .eq('auth_user_id', user.id)
      .single()

    if (!userData) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    const service = createServiceClient()
    const { data: config } = await service
      .from('sdr_configs')
      .select('uazapi_instance_url, uazapi_token')
      .eq('company_id', userData.company_id)
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
      .eq('company_id', userData.company_id)

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[SDR disconnect]', err)
    return NextResponse.json({ error: err.message || 'Erro ao desconectar' }, { status: 500 })
  }
}
