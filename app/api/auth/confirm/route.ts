import { createClient } from '@/lib/supabase/server'
import { syslog } from '@/lib/logger'
import { NextResponse } from 'next/server'

// Troca o code de recuperação de senha por sessão -- precisa ser no servidor
// porque o verificador PKCE foi salvo em cookie pelo mesmo client server-side
// que chamou resetPasswordForEmail (em /api/auth/forgot-password). O
// navegador não enxerga esse cookie, então a troca só funciona aqui.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/reset-password'

  const forwardedHost = request.headers.get('x-forwarded-host')
  const base = process.env.NODE_ENV === 'development' ? origin : forwardedHost ? `https://${forwardedHost}` : origin

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${base}${next}`)
    }
    await syslog({
      type: 'error',
      severity: 'warning',
      message: '[auth/confirm] exchangeCodeForSession falhou',
      payload: { error: error.message, name: error.name, status: (error as { status?: number }).status },
    })
  }

  return NextResponse.redirect(`${base}${next}?error=link_invalid`)
}
