import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

export async function POST(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const body = await req.json()
  const { endpoint, keys } = body

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: 'endpoint e keys obrigatórios' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Busca attendant pelo auth_user_id
  const { data: attendant } = await supabase
    .from('attendants')
    .select('id')
    .eq('company_id', context.companyId)
    .eq('active', true)
    .maybeSingle()

  if (!attendant) {
    return NextResponse.json({ ok: true, note: 'attendant não encontrado — subscription não salva' })
  }

  await supabase
    .from('push_subscriptions')
    .upsert(
      {
        attendant_id: attendant.id,
        endpoint,
        keys_p256dh: keys.p256dh,
        keys_auth: keys.auth,
      },
      { onConflict: 'attendant_id,endpoint' }
    )

  return NextResponse.json({ ok: true })
}
