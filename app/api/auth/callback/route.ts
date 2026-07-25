import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Rotas internas permitidas para redirect — previne open redirect
function safeRedirect(base: string, next: string): string {
  try {
    const url = new URL(next, base)
    if (url.origin !== base) return `${base}/dashboard`
  } catch {
    // next não é URL válida — trata como path
  }
  if (!next.startsWith('/') || next.startsWith('//')) return `${base}/dashboard`
  return `${base}${next}`
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  const getBase = () => {
    const forwardedHost = request.headers.get('x-forwarded-host')
    const isLocal = process.env.NODE_ENV === 'development'
    if (isLocal) return origin
    if (forwardedHost) return `https://${forwardedHost}`
    return origin
  }

  if (code) {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && user) {
      const base = getBase()
      const service = createServiceClient()

      // 1. Usuário já tem registro por auth_user_id — fluxo normal
      const { data: existing } = await service
        .from('users')
        .select('id, company_id')
        .eq('auth_user_id', user.id)
        .maybeSingle()

      if (existing?.company_id) {
        return NextResponse.redirect(safeRedirect(base, next))
      }

      // 2. Verifica se existe convite — registro em users com este email mas sem auth_user_id
      // Isso cobre o caso onde o admin pré-criou o usuário no painel
      const { data: invited } = await service
        .from('users')
        .select('id, company_id, role')
        .eq('email', user.email ?? '')
        .is('auth_user_id', null)
        .maybeSingle()

      if (invited) {
        // Vincula o auth_user_id ao convite existente — mantém role definida pelo admin
        const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || ''
        await service.from('users').update({
          auth_user_id: user.id,
          name: displayName,
          is_active: true,
        }).eq('id', invited.id)
        return NextResponse.redirect(safeRedirect(base, next))
      }

      // 3. Usuário realmente novo — sem convite, sem registro → onboarding
      return NextResponse.redirect(`${base}/onboarding`)
    }
  }

  return NextResponse.redirect(`${getBase()}/login?error=auth-error`)
}
