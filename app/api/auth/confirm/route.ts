import { createClient } from '@/lib/supabase/server'
import { syslog } from '@/lib/logger'
import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

// Verifica o token_hash do e-mail (recovery/signup/invite/magiclink/email_change)
// direto pelo verifyOtp, sem precisar de um verificador PKCE salvo em cookie
// antes. O link de code+PKCE exige que o pedido e o clique aconteçam no MESMO
// navegador -- quebra sempre que o e-mail é aberto num navegador/aba/aparelho
// diferente de onde "esqueci minha senha" foi pedido (confirmado pelo erro real
// AuthPKCECodeVerifierMissingError). token_hash não tem essa exigência.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/reset-password'

  const forwardedHost = request.headers.get('x-forwarded-host')
  const base = process.env.NODE_ENV === 'development' ? origin : forwardedHost ? `https://${forwardedHost}` : origin

  if (token_hash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ token_hash, type })
    if (!error) {
      return NextResponse.redirect(`${base}${next}`)
    }
    await syslog({
      type: 'error',
      severity: 'warning',
      message: '[auth/confirm] verifyOtp falhou',
      payload: { error: error.message, name: error.name, status: (error as { status?: number }).status, type },
    })
  }

  return NextResponse.redirect(`${base}${next}?error=link_invalid`)
}
