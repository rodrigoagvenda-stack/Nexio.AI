import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { createUazapiClient } from '@/lib/sdr/uazapi'

// GET /api/sdr/status — consulta status da instância em tempo real
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('auth_user_id', user.id)
      .single()

    if (!userData) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    const service = createServiceClient()
    const [{ data: config }, { data: companyData }] = await Promise.all([
      service
        .from('sdr_configs')
        .select('uazapi_instance_url, uazapi_token, uazapi_instance_name, instance_status, instance_phone, whatsapp_provider, meta_wa_phone_number_id')
        .eq('company_id', userData.company_id)
        .single(),
      service
        .from('companies')
        .select('allow_uazapi')
        .eq('id', userData.company_id)
        .single(),
    ])

    const allowUazapi = companyData?.allow_uazapi ?? false

    // ── Provider Meta Cloud API (ou uazapi desabilitado pelo admin) ──────────
    if (config?.whatsapp_provider === 'meta' || !allowUazapi) {
      const metaConnected = !!config.meta_wa_phone_number_id
      return NextResponse.json({
        status: metaConnected ? 'connected' : 'disconnected',
        phone: config.meta_wa_phone_number_id ?? null,
        provider: 'meta',
        allowUazapi,
      })
    }

    // ── Provider uazapi ──────────────────────────────────────────────────────
    if (!config?.uazapi_token || !config?.uazapi_instance_url) {
      return NextResponse.json({ status: 'disconnected', phone: null, provider: 'uazapi', allowUazapi })
    }

    // Suporta token plain text (novo) e formato legado criptografado
    let token: string = config.uazapi_token
    if (token.includes(':') && token.split(':').length === 3) {
      try {
        const { decrypt } = await import('@/lib/crypto')
        token = decrypt(token)
      } catch {
        return NextResponse.json({ status: 'disconnected', phone: null, qrcode: null, pairingCode: null, provider: 'uazapi', allowUazapi })
      }
    }

    const client = createUazapiClient(config.uazapi_instance_url, token)

    let liveStatus: Awaited<ReturnType<typeof client.getStatus>>
    try {
      liveStatus = await client.getStatus()
    } catch (uazErr: any) {
      const msg = uazErr.message ?? ''
      // Instância foi deletada no servidor (inatividade, incidente, etc.)
      if (msg.includes('401') || msg.includes('404') || msg.toLowerCase().includes('not found')) {
        await service.from('sdr_configs').update({
          uazapi_token: null,
          uazapi_instance_url: null,
          uazapi_instance_name: null,
          instance_status: 'disconnected',
          instance_phone: null,
        }).eq('company_id', userData.company_id)
      }
      return NextResponse.json({ status: 'disconnected', phone: null, qrcode: null, pairingCode: null, provider: 'uazapi', allowUazapi })
    }

    if (liveStatus.status !== config.instance_status || liveStatus.phone !== config.instance_phone) {
      await service
        .from('sdr_configs')
        .update({
          instance_status: liveStatus.status,
          instance_phone: liveStatus.phone ?? null,
        })
        .eq('company_id', userData.company_id)
    }

    const rawQr = liveStatus.qrcode ?? null
    const qrcode = rawQr ? rawQr.replace(/^data:image\/[^;]+;base64,/, '') : null

    return NextResponse.json({
      status: liveStatus.status,
      phone: liveStatus.phone ?? null,
      qrcode,
      pairingCode: liveStatus.pairingCode ?? null,
      instanceName: config.uazapi_instance_name ?? null,
      provider: 'uazapi',
      allowUazapi,
    })
  } catch (err: any) {
    console.error('[SDR status]', err)
    return NextResponse.json({ error: err.message || 'Erro ao buscar status' }, { status: 500 })
  }
}
