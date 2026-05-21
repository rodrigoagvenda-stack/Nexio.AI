import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { sendContatoNotificacaoEmail, sendContatoConfirmacaoEmail } from '@/lib/email/resend'

function getIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

export async function POST(req: NextRequest) {
  const ip = getIp(req)
  const limiter = rateLimit({ key: `contato:${ip}`, limit: 3, windowMs: 60 * 60 * 1000 })
  if (!limiter.success) {
    return NextResponse.json(
      { success: false, error: 'Muitas solicitações. Tente novamente em 1 hora.' },
      { status: 429 }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido.' }, { status: 400 })
  }

  const { nome, email, empresa, mensagem } = body as Record<string, string>

  if (!nome || typeof nome !== 'string' || nome.trim().length < 2) {
    return NextResponse.json({ success: false, error: 'Nome inválido.' }, { status: 422 })
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!email || !emailRegex.test(email)) {
    return NextResponse.json({ success: false, error: 'E-mail inválido.' }, { status: 422 })
  }

  if (!mensagem || mensagem.trim().length < 10) {
    return NextResponse.json({ success: false, error: 'Mensagem muito curta.' }, { status: 422 })
  }

  void Promise.all([
    sendContatoNotificacaoEmail({
      nome: nome.trim(),
      email: email.trim().toLowerCase(),
      empresa: empresa?.trim() || null,
      mensagem: mensagem.trim(),
    }),
    sendContatoConfirmacaoEmail({
      nome: nome.trim(),
      email: email.trim().toLowerCase(),
    }),
  ]).catch((err) => console.error('[Contato] Erro ao enviar emails:', err))

  return NextResponse.json({ success: true }, { status: 201 })
}
