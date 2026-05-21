import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';
import { sendLgpdConfirmacaoEmail, sendLgpdAlertaDpoEmail } from '@/lib/email/resend';

const TIPOS_VALIDOS = ['acesso', 'correcao', 'exclusao', 'portabilidade', 'revogacao'] as const;
type TipoSolicitacao = (typeof TIPOS_VALIDOS)[number];

function isTipoValido(tipo: string): tipo is TipoSolicitacao {
  return TIPOS_VALIDOS.includes(tipo as TipoSolicitacao);
}

function getIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

export async function POST(req: NextRequest) {
  // ── Rate limit: 3 req/hora por IP ──────────────────────────────────────────
  const ip = getIp(req);
  const limiter = rateLimit({ key: `lgpd:${ip}`, limit: 3, windowMs: 60 * 60 * 1000 });
  if (!limiter.success) {
    return NextResponse.json(
      { success: false, error: 'Muitas solicitações. Tente novamente em 1 hora.' },
      { status: 429 }
    );
  }

  // ── Parse ──────────────────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido.' }, { status: 400 });
  }

  const { nome, email, tipo, mensagem } = body as Record<string, string>;

  // ── Validação ─────────────────────────────────────────────────────────────
  if (!nome || typeof nome !== 'string' || nome.trim().length < 2) {
    return NextResponse.json({ success: false, error: 'Nome inválido.' }, { status: 422 });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    return NextResponse.json({ success: false, error: 'E-mail inválido.' }, { status: 422 });
  }

  if (!tipo || !isTipoValido(tipo)) {
    return NextResponse.json(
      { success: false, error: 'Tipo de solicitação inválido.' },
      { status: 422 }
    );
  }

  // ── Inserir no Supabase ───────────────────────────────────────────────────
  const supabase = createServiceClient();

  const nomeTrimmed = nome.trim()
  const emailNorm = email.trim().toLowerCase()
  const mensagemTrimmed = mensagem?.trim() || null
  const protocolo = `LGPD-${Date.now().toString(36).toUpperCase()}`

  const { error } = await supabase.from('lgpd_solicitacoes').insert({
    nome: nomeTrimmed,
    email: emailNorm,
    tipo,
    mensagem: mensagemTrimmed,
    status: 'pendente',
    protocolo,
  });

  if (error) {
    console.error('[LGPD] Erro ao inserir solicitação:', error.message);
    return NextResponse.json(
      { success: false, error: 'Erro interno. Tente novamente ou envie e-mail para privacidade@zaapply.com.br.' },
      { status: 500 }
    );
  }

  // Dispara emails em paralelo — não bloqueia a resposta se falhar
  void Promise.all([
    sendLgpdConfirmacaoEmail({ to: emailNorm, nome: nomeTrimmed, tipo, protocolo }),
    sendLgpdAlertaDpoEmail({ nome: nomeTrimmed, email: emailNorm, tipo, mensagem: mensagemTrimmed, protocolo }),
  ]).catch((err) => console.error('[LGPD] Erro ao enviar emails:', err))

  return NextResponse.json({ success: true, protocolo }, { status: 201 });
}
