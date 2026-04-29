import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const cache = new Map<string, string | null>()

export async function GET(request: NextRequest) {
  const phone = request.nextUrl.searchParams.get('phone')
  if (!phone) return NextResponse.json({ photo: null })

  if (cache.has(phone)) return NextResponse.json({ photo: cache.get(phone) ?? null })

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ photo: null })

    const { data: userData } = await supabase
      .from('users').select('company_id').eq('auth_user_id', user.id).single()
    if (!userData) return NextResponse.json({ photo: null })

    const service = createServiceClient()
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

    if (!res.ok) { cache.set(phone, null); return NextResponse.json({ photo: null }) }

    const data = await res.json()
    const photo: string | null =
      data?.wa_profilePicUrl ||
      data?.wa_profilePicThumbObj?.url ||
      data?.chat?.wa_profilePicUrl ||
      null

    cache.set(phone, photo)
    return NextResponse.json({ photo })
  } catch {
    return NextResponse.json({ photo: null })
  }
}
