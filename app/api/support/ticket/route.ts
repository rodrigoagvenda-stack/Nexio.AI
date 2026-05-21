import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { sendSuporteNotificacaoEmail, sendSuporteConfirmacaoEmail } from '@/lib/email/resend'
import { requireAuth } from '@/lib/auth/require-auth'

function getIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

export async function POST(req: NextRequest) {
  const ip = getIp(req)
  const limiter = rateLimit({ key: `suporte:${ip}`, limit: 5, windowMs: 60 * 60 * 1000 })
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

  const { nome, email, assunto, mensagem, images } = body as Record<string, string> & { images?: string[] }

  if (!nome || typeof nome !== 'string' || nome.trim().length < 2)
    return NextResponse.json({ success: false, error: 'Nome inválido.' }, { status: 422 })

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!email || !emailRegex.test(email))
    return NextResponse.json({ success: false, error: 'E-mail inválido.' }, { status: 422 })

  if (!assunto || assunto.trim().length < 3)
    return NextResponse.json({ success: false, error: 'Assunto inválido.' }, { status: 422 })

  if (!mensagem || mensagem.trim().length < 10)
    return NextResponse.json({ success: false, error: 'Mensagem muito curta.' }, { status: 422 })

  const protocolo = `SUP-${Date.now().toString(36).toUpperCase()}`

  // Try to get auth context to link ticket to company
  let companyId: string | null = null
  let userId: string | null = null
  try {
    const auth = await requireAuth(req)
    if (!auth.error) {
      companyId = auth.context.companyId as unknown as string
      userId = auth.context.userId
    }
  } catch { /* anonymous submission fallback */ }

  const service = createServiceClient()
  await service.from('support_tickets').insert({
    company_id: companyId,
    user_id: userId,
    protocolo,
    nome: nome.trim(),
    email: email.trim().toLowerCase(),
    assunto: assunto.trim(),
    mensagem: mensagem.trim(),
    images: Array.isArray(images) ? images.slice(0, 5) : [],
  })

  void Promise.all([
    sendSuporteNotificacaoEmail({ nome: nome.trim(), email: email.trim().toLowerCase(), assunto: assunto.trim(), mensagem: mensagem.trim(), protocolo }),
    sendSuporteConfirmacaoEmail({ nome: nome.trim(), email: email.trim().toLowerCase(), assunto: assunto.trim(), protocolo }),
  ]).catch((err) => console.error('[Suporte] Erro ao enviar emails:', err))

  return NextResponse.json({ success: true, protocolo }, { status: 201 })
}
