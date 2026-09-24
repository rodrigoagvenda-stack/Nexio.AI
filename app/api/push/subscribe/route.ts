import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

// GET    /api/push/subscribe : devolve a chave pública VAPID (null se o servidor ainda não tem as chaves)
// POST   /api/push/subscribe : registra este aparelho para a pessoa logada
// DELETE /api/push/subscribe : remove este aparelho
// A chave vem do servidor em tempo de execução, então não depende de variável embutida no build.

export async function GET(req: NextRequest) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError
  return NextResponse.json({ publicKey: process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY ? process.env.VAPID_PUBLIC_KEY : null })
}

export async function POST(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  let body: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Corpo inválido' }, { status: 400 })
  }
  const endpoint = typeof body.endpoint === 'string' ? body.endpoint : ''
  const p256dh = typeof body.keys?.p256dh === 'string' ? body.keys.p256dh : ''
  const auth = typeof body.keys?.auth === 'string' ? body.keys.auth : ''
  if (!endpoint.startsWith('https://') || endpoint.length > 2048 || !p256dh || !auth) {
    return NextResponse.json({ error: 'endpoint e keys obrigatórios' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // O aparelho é de quem se inscreveu por último: se outra pessoa usava este navegador, ela deixa de receber aqui.
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint).neq('user_id', context.userId)

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: context.userId,
      company_id: context.companyId,
      endpoint,
      keys_p256dh: p256dh,
      keys_auth: auth,
      user_agent: (req.headers.get('user-agent') ?? '').slice(0, 300),
    },
    { onConflict: 'user_id,endpoint' },
  )
  if (error) {
    console.error('[push/subscribe] erro:', error.message)
    return NextResponse.json({ error: 'Não foi possível registrar este aparelho' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  let body: { endpoint?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Corpo inválido' }, { status: 400 })
  }
  if (typeof body.endpoint !== 'string' || !body.endpoint) {
    return NextResponse.json({ error: 'endpoint obrigatório' }, { status: 400 })
  }

  const supabase = createServiceClient()
  await supabase.from('push_subscriptions').delete().eq('user_id', context.userId).eq('endpoint', body.endpoint)
  return NextResponse.json({ ok: true })
}
