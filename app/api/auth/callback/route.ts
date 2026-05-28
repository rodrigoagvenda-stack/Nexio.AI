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

      const service = createServiceClient()

      // 1. Verifica por auth_user_id (fluxo normal)
      const { data: existing } = await service
        .from('users')
        .select('id, company_id')
        .eq('auth_user_id', user.id)
        .maybeSingle()

      if (existing?.company_id) {
        return NextResponse.redirect(`${base}${next}`)
      }

      // 2. Verifica se já existe company com este email (Google OAuth sem users record)
      const { data: existingCompany } = await service
        .from('companies')
        .select('id')
        .eq('email', user.email ?? '')
        .maybeSingle()

      if (existingCompany) {
        // Vincula auth_user_id à company existente e vai direto pro dashboard
        const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || ''
        await service.from('users').upsert({
          auth_user_id: user.id,
          user_id: user.id,
          company_id: existingCompany.id,
          name: displayName,
          email: user.email ?? '',
          role: 'admin',
          is_active: true,
        }, { onConflict: 'auth_user_id' })
        return NextResponse.redirect(`${base}${next}`)
      }

      // 3. Usuário realmente novo → onboarding
      return NextResponse.redirect(`${base}/onboarding`)
    }
  }

  return NextResponse.redirect(`${getBase()}/login?error=auth-error`)
}
