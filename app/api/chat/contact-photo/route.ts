import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const cache = new Map<string, string | null>()

export async function GET(request: NextRequest) {
  const phone = request.nextUrl.searchParams.get('phone')
  const leadId = request.nextUrl.searchParams.get('leadId')
  if (!phone) return NextResponse.json({ photo: null })

  const cacheKey = leadId ? `lead:${leadId}` : phone
  if (cache.has(cacheKey)) return NextResponse.json({ photo: cache.get(cacheKey) ?? null })

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ photo: null })

    const { data: userData } = await supabase
      .from('users').select('company_id').eq('auth_user_id', user.id).single()
    if (!userData) return NextResponse.json({ photo: null })

    const service = createServiceClient()

    // Primeiro tenta por id_do_lead (mais confiável que phone matching)
    let convQuery = service
      .from('conversas_do_whatsapp')
      .select('whatsapp_photo_url')
      .eq('company_id', userData.company_id)
      .not('whatsapp_photo_url', 'is', null)

    if (leadId) {
      convQuery = (convQuery as any).eq('id_do_lead', Number(leadId))
    } else {
      convQuery = (convQuery as any).eq('numero_de_telefone', phone)
    }

    const { data: conv } = await (convQuery as any).maybeSingle()

    if (conv?.whatsapp_photo_url) {
      cache.set(cacheKey, conv.whatsapp_photo_url)
      return NextResponse.json({ photo: conv.whatsapp_photo_url })
    }

    // Fallback: busca na uazapi
    const { data: config } = await service
      .from('sdr_configs')
      .select('uazapi_instance_url, uazapi_token')
      .eq('company_id', userData.company_id)
      .single()

    if (!config?.uazapi_token) return NextResponse.json({ photo: null })

    let token: string = config.uazapi_token
    if (token.includes(':') && token.split(':').length === 3) {
      try { const { decrypt } = await import('@/lib/crypto'); token = decrypt(token) } catch { return NextResponse.json({ photo: null }) }
    }

    const baseUrl = (config.uazapi_instance_url || 'https://nexioai.uazapi.com').replace(/\/$/, '')
    const res = await fetch(`${baseUrl}/chat/details`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token },
      body: JSON.stringify({ number: phone }),
    })

    if (!res.ok) { cache.set(cacheKey, null); return NextResponse.json({ photo: null }) }

    const data = await res.json()
    // /chat/details retorna campos iguais ao webhook: image, imagePreview
    const photo: string | null =
      data?.image ||
      data?.imagePreview ||
      data?.wa_profilePicUrl ||
      data?.wa_profilePicThumbObj?.url ||
      data?.chat?.wa_profilePicUrl ||
      data?.chat?.image ||
      null

    cache.set(cacheKey, photo)
    return NextResponse.json({ photo })
  } catch {
    return NextResponse.json({ photo: null })
  }
}
