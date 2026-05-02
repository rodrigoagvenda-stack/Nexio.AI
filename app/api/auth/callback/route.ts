import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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

      // Verifica se já tem registro na tabela users (já passou pelo onboarding)
      const service = createServiceClient()
      const { data: existing } = await service
        .from('users')
        .select('id, company_id')
        .eq('auth_user_id', user.id)
        .maybeSingle()

      if (!existing?.company_id) {
        // Novo usuário → onboarding
        return NextResponse.redirect(`${base}/onboarding`)
      }

      // Usuário existente → destino normal
      return NextResponse.redirect(`${base}${next}`)
    }
  }

  return NextResponse.redirect(`${getBase()}/login?error=auth-error`)
}
