import { Resend } from 'resend';

export async function sendInjectionAlertEmail({
  pushName,
  senderNumber,
  instanceName,
  originalMessage,
  classification,
  riskLevel,
  confidence,
  evidence,
  timestamp,
}: {
  pushName: string
  senderNumber: string
  instanceName: string
  originalMessage: string
  classification: string
  riskLevel: string
  confidence: number
  evidence?: string
  timestamp: string
}) {
  if (!process.env.RESEND_API_KEY) return { success: false }
  const client = new Resend(process.env.RESEND_API_KEY)

  const { data, error } = await client.emails.send({
    from: 'Nexio.AI Segurança <noreply@vendai.com.br>',
    to: ['rodrigoevangelista.proj@gmail.com'],
    subject: '🚨 ALERTA: Tentativa de Prompt Injection Bloqueada',
    html: `
<h2>⚠️ Tentativa de Ataque Bloqueada</h2>
<p><strong>Usuário bloqueado automaticamente por tentativa de prompt injection.</strong></p>
<h3>📋 Detalhes do Ataque:</h3>
<ul>
  <li><strong>Nome:</strong> ${pushName}</li>
  <li><strong>Número:</strong> ${senderNumber}</li>
  <li><strong>Instância:</strong> ${instanceName}</li>
  <li><strong>Data/Hora:</strong> ${timestamp}</li>
</ul>
<h3>🔍 Análise de Segurança:</h3>
<ul>
  <li><strong>Classificação:</strong> ${classification}</li>
  <li><strong>Nível de Risco:</strong> ${riskLevel}</li>
  <li><strong>Confiança:</strong> ${confidence}</li>
  <li><strong>Ação Recomendada:</strong> HARD_BLOCK_24H</li>
</ul>
<h3>💬 Mensagem Original:</h3>
<blockquote style="background:#f5f5f5;padding:10px;border-left:4px solid #ff0000;">
${originalMessage}
</blockquote>
<h3>🛡️ Evidência Detectada:</h3>
<p><code>${evidence ?? 'Padrão composto detectado'}</code></p>
<hr>
<p><small>Sistema de Segurança - Prompt Injection Detection v2.1</small></p>
    `,
  })

  if (error) return { success: false, message: error.message }
  return { success: true, data }
}

// Lazy initialization to avoid build-time errors
let resend: Resend | null = null;

function getResend() {
  if (!resend && process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

export async function sendTokenAlertEmail({
  to,
  companyName,
  percent,
  usedTokens,
  quota,
}: {
  to: string;
  companyName: string;
  percent: 80 | 95;
  usedTokens: number;
  quota: number;
}) {
  const client = getResend();
  if (!client) return { success: false };

  const fmt = (n: number) => n.toLocaleString('pt-BR');
  const color = percent >= 95 ? '#ef4444' : '#f59e0b';
  const label = percent >= 95 ? 'crítico' : 'atenção';
  const subject = percent >= 95
    ? `⚠️ ${companyName} — 95% da franquia de tokens consumida`
    : `ℹ️ ${companyName} — 80% da franquia de tokens consumida`;

  const { data, error } = await client.emails.send({
    from: 'Zaapply <noreply@zaapply.com.br>',
    to: [to],
    subject,
    html: `<!DOCTYPE html><html><body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f5f5f5;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:40px auto;background:#fff;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,.1);">
        <tr><td style="padding:32px 40px 16px;">
          <h1 style="margin:0;color:#111;font-size:22px;font-weight:700;">Alerta de consumo — ${label}</h1>
        </td></tr>
        <tr><td style="padding:0 40px 32px;">
          <p style="color:#444;font-size:15px;line-height:1.6;">
            A empresa <strong>${companyName}</strong> atingiu <strong style="color:${color}">${percent}%</strong> da franquia mensal de tokens.
          </p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr style="background:#f9f9f9;">
              <td style="padding:10px 14px;font-size:13px;color:#666;border:1px solid #eee;">Tokens usados</td>
              <td style="padding:10px 14px;font-size:13px;font-weight:600;color:#111;border:1px solid #eee;">${fmt(usedTokens)}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;font-size:13px;color:#666;border:1px solid #eee;">Franquia mensal</td>
              <td style="padding:10px 14px;font-size:13px;font-weight:600;color:#111;border:1px solid #eee;">${fmt(quota)}</td>
            </tr>
            <tr style="background:#f9f9f9;">
              <td style="padding:10px 14px;font-size:13px;color:#666;border:1px solid #eee;">Percentual</td>
              <td style="padding:10px 14px;font-size:13px;font-weight:600;color:${color};border:1px solid #eee;">${percent}%</td>
            </tr>
          </table>
          ${percent >= 95
            ? '<p style="color:#ef4444;font-size:14px;">Ao esgotar a franquia o agente será pausado automaticamente. Adquira um pacote extra ou aguarde a renovação mensal.</p>'
            : '<p style="color:#666;font-size:14px;">Monitore o consumo para evitar a pausa automática do agente ao atingir 100%.</p>'}
        </td></tr>
        <tr><td style="padding:16px 40px;background:#f9f9f9;border-top:1px solid #eee;border-radius:0 0 8px 8px;">
          <p style="margin:0;color:#999;font-size:12px;">Email automático — não responda.</p>
        </td></tr>
      </table>
    </body></html>`,
  });

  if (error) return { success: false, message: error.message };
  return { success: true, data };
}

export async function sendMemberInviteEmail({
  to,
  name,
  companyName,
  role,
}: {
  to: string;
  name: string;
  companyName: string;
  role: string;
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY não configurado. Email não será enviado.');
    return { success: false, message: 'Resend não configurado' };
  }

  const resendClient = getResend();
  if (!resendClient) {
    return { success: false, message: 'Resend não configurado' };
  }

  try {
    const roleLabels: Record<string, string> = {
      admin: 'Administrador',
      manager: 'Gerente',
      member: 'Membro',
    };

    const roleLabel = roleLabels[role] || 'Membro';

    const { data, error } = await resendClient.emails.send({
      from: 'vend.AI <noreply@vendai.com.br>',
      to: [to],
      subject: `Convite para ${companyName} na vend.AI`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Convite vend.AI</title>
          </head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <tr>
                <td style="padding: 40px 40px 20px;">
                  <h1 style="margin: 0; color: #F79506; font-size: 28px; font-weight: bold;">vend.AI</h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 0 40px 40px;">
                  <h2 style="margin: 0 0 20px; color: #1a1a1a; font-size: 24px; font-weight: 600;">
                    Olá, ${name}!
                  </h2>
                  <p style="margin: 0 0 20px; color: #666666; font-size: 16px; line-height: 1.6;">
                    Você foi convidado para fazer parte da equipe <strong>${companyName}</strong> na plataforma vend.AI como <strong>${roleLabel}</strong>.
                  </p>
                  <p style="margin: 0 0 30px; color: #666666; font-size: 16px; line-height: 1.6;">
                    Para começar, acesse a plataforma e faça login com este email:
                  </p>
                  <table cellpadding="0" cellspacing="0" style="width: 100%;">
                    <tr>
                      <td align="center">
                        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://app.vendai.com.br'}/login" style="display: inline-block; padding: 14px 32px; background-color: #F79506; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                          Acessar vend.AI
                        </a>
                      </td>
                    </tr>
                  </table>
                  <p style="margin: 30px 0 0; color: #999999; font-size: 14px; line-height: 1.6;">
                    Você receberá um email separado com instruções para criar sua senha.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding: 20px 40px; background-color: #f9f9f9; border-top: 1px solid #eeeeee; border-radius: 0 0 8px 8px;">
                  <p style="margin: 0; color: #999999; font-size: 12px; line-height: 1.5;">
                    Este é um email automático. Por favor, não responda.
                  </p>
                  <p style="margin: 10px 0 0; color: #999999; font-size: 12px;">
                    © ${new Date().getFullYear()} vend.AI. Todos os direitos reservados.
                  </p>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('Erro ao enviar email:', error);
      return { success: false, message: error.message };
    }

    return { success: true, data };
  } catch (error: any) {
    console.error('Erro ao enviar email:', error);
    return { success: false, message: error.message };
  }
}

// ─── Shared brand template ───────────────────────────────────────────────────

const _SVG_P1 = 'M207.65 103.853C207.65 104.953 207.65 106.063 207.59 107.143V107.213C207.562 120.28 205.556 133.267 201.64 145.733C194.543 167.855 181.706 187.699 164.44 203.243C146.982 218.999 125.668 229.859 102.66 234.723V207.653C82.1745 207.423 62.2151 201.137 45.2943 189.587C28.3736 178.037 15.2477 161.74 7.56905 142.747C-0.109597 123.753 -1.99782 102.913 2.14207 82.8485C6.28195 62.7843 16.2649 44.3933 30.8343 29.9904C45.4037 15.5875 63.9083 5.81663 84.0187 1.90763C104.129 -2.00137 124.946 0.126266 143.85 8.02272C162.754 15.9192 178.9 29.2315 190.254 46.2839C201.609 63.3363 207.665 83.3666 207.66 103.853H207.65Z'
const _SVG_P2 = 'M82.5917 152.783C77.2584 152.783 73.3551 151.533 70.8817 149.033C69.6593 147.837 68.6957 146.402 68.0506 144.818C67.4056 143.233 67.0928 141.534 67.1317 139.823C67.2062 136.582 67.9519 133.392 69.3217 130.453C70.8962 126.943 73.1222 123.764 75.8817 121.083L110.712 84.6934H76.5917C75.2672 84.6934 73.9556 84.4324 72.732 83.9252C71.5084 83.418 70.3967 82.6746 69.4605 81.7375C68.5244 80.8005 67.7821 79.6881 67.2761 78.464C66.7702 77.2398 66.5104 75.928 66.5117 74.6034C66.5117 71.7285 67.6538 68.9713 69.6867 66.9384C71.7196 64.9055 74.4768 63.7634 77.3517 63.7634H125.082C130.915 63.7634 135.132 65.0101 137.732 67.5034C138.968 68.6341 139.953 70.011 140.625 71.5456C141.297 73.0801 141.64 74.7383 141.632 76.4134C141.632 81.7468 139.395 86.9001 134.922 91.8734L97.9217 131.873H129.922C132.799 131.873 135.559 133.017 137.594 135.051C139.629 137.086 140.772 139.846 140.772 142.723C140.769 144.054 140.503 145.371 139.989 146.598C139.475 147.825 138.723 148.938 137.777 149.874C136.831 150.809 135.708 151.548 134.475 152.047C133.242 152.546 131.922 152.797 130.592 152.783H82.5917Z'

function _logoSvg(onGreenBg: boolean) {
  const [c1, c2] = onGreenBg ? ['#ffffff', '#15803d'] : ['#369E47', '#ffffff']
  return `<svg width="26" height="29" viewBox="0 0 208 235" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="${_SVG_P1}" fill="${c1}"/><path d="${_SVG_P2}" fill="${c2}"/></svg>`
}

function zaapplyHtml(opts: {
  heading: string
  body: string
  button?: { text: string; url: string }
  footer?: string
}) {
  const btn = opts.button
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;"><tr><td align="center"><a href="${opts.button.url}" style="display:inline-block;padding:14px 40px;background:#16a34a;color:#ffffff;text-decoration:none;border-radius:50px;font-weight:700;font-size:15px;letter-spacing:0.2px;">${opts.button.text}</a></td></tr></table>`
    : ''
  const footer = opts.footer ?? 'Zaapply · zaapply.com.br · Email automático, não responda.'
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="margin:0;padding:0;background:#15803d;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:48px 20px;"><table cellpadding="0" cellspacing="0" style="width:100%;max-width:460px;"><tr><td align="center" style="padding-bottom:6px;"><table cellpadding="0" cellspacing="0"><tr><td valign="middle" style="padding-right:9px;">${_logoSvg(true)}</td><td valign="middle"><span style="font-family:Nunito,Poppins,'Helvetica Neue',Arial,sans-serif;font-weight:800;font-size:22px;color:#ffffff;letter-spacing:-0.01em;line-height:1;">zaapply</span></td></tr></table></td></tr><tr><td align="center" style="padding-bottom:22px;"><p style="margin:0;color:rgba(255,255,255,0.6);font-size:12px;font-weight:600;letter-spacing:0.5px;">Venda enquanto dorme.</p></td></tr><tr><td style="background:#ffffff;border-radius:20px;padding:40px 36px;"><h2 style="margin:0 0 16px;color:#111111;font-size:20px;font-weight:700;line-height:1.3;">${opts.heading}</h2>${opts.body}${btn}</td></tr><tr><td align="center" style="padding-top:20px;"><p style="margin:0;color:rgba(255,255,255,0.65);font-size:12px;line-height:1.7;">${footer}</p></td></tr></table></td></tr></table></body></html>`
}

function _tr(label: string, value: string, alt = false, highlight = false) {
  return `<tr style="${alt ? 'background:#f0fdf4;' : ''}"><td style="padding:11px 16px;font-size:13px;color:#6b7280;border:1px solid #e5e7eb;width:42%;">${label}</td><td style="padding:11px 16px;font-size:13px;${highlight ? 'color:#15803d;font-weight:700;' : 'color:#111111;font-weight:600;'}border:1px solid #e5e7eb;">${value}</td></tr>`
}

const TIPO_LGPD_LABELS: Record<string, string> = {
  acesso: 'Acesso aos meus dados',
  correcao: 'Correção de dados',
  exclusao: 'Exclusão de dados',
  portabilidade: 'Portabilidade de dados',
  revogacao: 'Revogação de consentimento',
}

export async function sendLgpdConfirmacaoEmail({
  to,
  nome,
  tipo,
  protocolo,
}: {
  to: string
  nome: string
  tipo: string
  protocolo: string
}) {
  const client = getResend()
  if (!client) return { success: false }

  const tipoLabel = TIPO_LGPD_LABELS[tipo] ?? tipo

  const { data, error } = await client.emails.send({
    from: 'Zaapply Privacidade <privacidade@zaapply.com.br>',
    to: [to],
    subject: `[Protocolo ${protocolo}] Solicitação LGPD recebida`,
    html: zaapplyHtml({
      heading: 'Solicitação LGPD recebida',
      body: `<p style="margin:0 0 20px;color:#444444;font-size:15px;line-height:1.7;">Olá, <strong style="color:#111111;">${nome}</strong>. Recebemos sua solicitação com base na LGPD e a processaremos dentro do prazo legal previsto.</p><table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 20px;">${_tr('Protocolo', protocolo, true, true)}${_tr('Tipo de solicitação', tipoLabel, false)}${_tr('Prazo de resposta', 'Até 15 dias úteis (Art. 19, LGPD)', true)}</table><p style="margin:0;color:#6b7280;font-size:13px;line-height:1.7;">Dúvidas? Escreva para <a href="mailto:privacidade@zaapply.com.br" style="color:#15803d;font-weight:600;">privacidade@zaapply.com.br</a> informando o protocolo <strong>${protocolo}</strong>.</p>`,
      footer: 'Zaapply · Encarregado de Dados (DPO): privacidade@zaapply.com.br',
    }),
  })

  if (error) return { success: false, message: error.message }
  return { success: true, data }
}

export async function sendLgpdAlertaDpoEmail({
  nome,
  email,
  tipo,
  mensagem,
  protocolo,
}: {
  nome: string
  email: string
  tipo: string
  mensagem?: string | null
  protocolo: string
}) {
  const client = getResend()
  if (!client) return { success: false }

  const tipoLabel = TIPO_LGPD_LABELS[tipo] ?? tipo

  const { data, error } = await client.emails.send({
    from: 'Zaapply Sistema <noreply@zaapply.com.br>',
    to: ['privacidade@zaapply.com.br'],
    subject: `[LGPD] Nova solicitação: ${tipoLabel} — ${protocolo}`,
    html: zaapplyHtml({
      heading: `Nova solicitação LGPD — ${tipoLabel}`,
      body: `<p style="margin:0 0 20px;color:#444444;font-size:15px;line-height:1.7;">Uma nova solicitação LGPD foi registrada. Prazo legal: <strong style="color:#15803d;">15 dias úteis</strong> (Art. 19, LGPD).</p><table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 20px;">${_tr('Protocolo', protocolo, true, true)}${_tr('Solicitante', nome, false)}${_tr('E-mail', `<a href="mailto:${email}" style="color:#15803d;">${email}</a>`, true)}${_tr('Tipo', tipoLabel, false)}${mensagem ? _tr('Mensagem adicional', mensagem, true) : ''}</table>`,
      footer: 'Zaapply · Sistema interno · LGPD',
    }),
  })

  if (error) return { success: false, message: error.message }
  return { success: true, data }
}

// ─── Suporte ────────────────────────────────────────────────────────────────

export async function sendSuporteNotificacaoEmail({
  nome,
  email,
  assunto,
  mensagem,
  protocolo,
}: {
  nome: string
  email: string
  assunto: string
  mensagem: string
  protocolo: string
}) {
  const client = getResend()
  if (!client) return { success: false }

  const { data, error } = await client.emails.send({
    from: 'Zaapply Sistema <noreply@zaapply.com.br>',
    to: ['suporte@zaapply.com.br'],
    reply_to: email,
    subject: `[${protocolo}] ${assunto}`,
    html: zaapplyHtml({
      heading: `Novo ticket: ${assunto}`,
      body: `<p style="margin:0 0 20px;color:#444444;font-size:15px;line-height:1.7;">Um novo chamado de suporte foi aberto. Responda este email para contatar o cliente diretamente (reply-to configurado).</p><table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 20px;">${_tr('Protocolo', protocolo, true, true)}${_tr('Nome', nome, false)}${_tr('E-mail', `<a href="mailto:${email}" style="color:#15803d;">${email}</a>`, true)}${_tr('Assunto', assunto, false)}${_tr('Mensagem', `<span style="line-height:1.6;white-space:pre-wrap;">${mensagem}</span>`, true)}</table>`,
      footer: 'Zaapply · Sistema de Suporte',
    }),
  })

  if (error) return { success: false, message: error.message }
  return { success: true, data }
}

export async function sendSuporteConfirmacaoEmail({
  nome,
  email,
  assunto,
  protocolo,
}: {
  nome: string
  email: string
  assunto: string
  protocolo: string
}) {
  const client = getResend()
  if (!client) return { success: false }

  const { data, error } = await client.emails.send({
    from: 'Zaapply Suporte <suporte@zaapply.com.br>',
    to: [email],
    subject: `[${protocolo}] Recebemos seu chamado`,
    html: zaapplyHtml({
      heading: 'Recebemos seu chamado!',
      body: `<p style="margin:0 0 20px;color:#444444;font-size:15px;line-height:1.7;">Olá, <strong style="color:#111111;">${nome}</strong>! Nossa equipe foi notificada e retornará em breve. Guarde o número do protocolo para acompanhar.</p><table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 20px;">${_tr('Protocolo', protocolo, true, true)}${_tr('Assunto', assunto, false)}${_tr('Prazo de resposta', 'Até 24 horas úteis', true)}</table><p style="margin:0;color:#6b7280;font-size:13px;line-height:1.7;">Para acompanhar, responda este email informando o protocolo <strong>${protocolo}</strong>.</p>`,
      footer: 'Zaapply · suporte@zaapply.com.br',
    }),
  })

  if (error) return { success: false, message: error.message }
  return { success: true, data }
}

// ─── Contato Comercial ───────────────────────────────────────────────────────

export async function sendContatoNotificacaoEmail({
  nome,
  email,
  empresa,
  mensagem,
}: {
  nome: string
  email: string
  empresa?: string | null
  mensagem: string
}) {
  const client = getResend()
  if (!client) return { success: false }

  const { data, error } = await client.emails.send({
    from: 'Zaapply Site <noreply@zaapply.com.br>',
    to: ['rodrigo@zaapply.com.br', 'contato@zaapply.com.br'],
    reply_to: email,
    subject: `Novo lead — ${nome}${empresa ? ` (${empresa})` : ''}`,
    html: zaapplyHtml({
      heading: 'Novo lead comercial',
      body: `<p style="margin:0 0 20px;color:#444444;font-size:15px;line-height:1.7;">Um novo contato chegou pelo formulário do site. Responda este email para falar diretamente com o lead.</p><table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 20px;">${_tr('Nome', nome, true)}${_tr('E-mail', `<a href="mailto:${email}" style="color:#15803d;">${email}</a>`, false)}${empresa ? _tr('Empresa', empresa, true) : ''}${_tr('Mensagem', `<span style="line-height:1.6;white-space:pre-wrap;">${mensagem}</span>`, !empresa)}</table>`,
      footer: 'Zaapply · Contato Comercial',
    }),
  })

  if (error) return { success: false, message: error.message }
  return { success: true, data }
}

export async function sendWelcomeEmail({
  nome,
  email,
  companyName,
  isTrial,
}: {
  nome: string
  email: string
  companyName: string
  isTrial?: boolean
}) {
  const client = getResend()
  if (!client) return { success: false }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.zaapply.com.br'
  const bodyText = isTrial
    ? `A empresa <strong style="font-weight:600;">${companyName}</strong> foi criada com sucesso. Você tem <strong style="font-weight:600;">7 dias grátis</strong> para explorar o CRM e o WhatsApp — sem cartão de crédito.`
    : `A empresa <strong style="font-weight:600;">${companyName}</strong> foi criada. Tudo pronto para começar a vender.`

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bem-vindo ao Zaapply</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;800&display=swap');
    body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
    table,td{mso-table-lspace:0pt;mso-table-rspace:0pt;}
    img{-ms-interpolation-mode:bicubic;border:0;outline:none;text-decoration:none;}
    body{margin:0!important;padding:0!important;background-color:#ffffff;}
    @media only screen and (max-width:600px){
      .card{width:100%!important;}
      .logo-img{width:150px!important;height:auto!important;}
      .headline{font-size:24px!important;}
      .body-text{font-size:15px!important;}
      .btn a{font-size:16px!important;padding:14px 28px!important;}
      .warn-cell{padding-left:20px!important;padding-right:20px!important;}
      .outer-pad{padding:24px 0!important;}
    }
  </style>
</head>
<body>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="background-color:#ffffff;">
    <tr>
      <td align="center" class="outer-pad" style="padding:48px 16px;background-color:#ffffff;">

        <table class="card" width="600" cellpadding="0" cellspacing="0" border="0" role="presentation"
          style="background-color:#ebebeb;background-image:url('https://app.zaapply.com.br/email-pattern.png');background-repeat:repeat;box-shadow:15px 15px 0px 0px #07261c;">

          <tr>
            <td align="center" style="padding:24px 48px 0;">
              <img class="logo-img" src="https://app.zaapply.com.br/logo-email.png" alt="Zaapply" width="209" height="67" style="display:block;" />
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:40px 48px 0;">
              <p class="headline" style="margin:0;font-family:'Montserrat',Arial,sans-serif;font-size:30px;font-weight:400;color:#1a1a1a;text-align:center;line-height:1.2;">
                Bem-vindo ao
                <span style="font-weight:800;border-bottom:3px solid #a6f821;padding-bottom:2px;">Zaapply.</span>
              </p>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:16px 64px 0;">
              <p class="body-text" style="margin:0;font-family:'Montserrat',Arial,sans-serif;font-size:18px;font-weight:400;color:#1a1a1a;text-align:center;line-height:1.65;">
                ${bodyText}
              </p>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:40px 48px 0;">
              <table class="btn" cellpadding="0" cellspacing="0" border="0" role="presentation">
                <tr>
                  <td style="background-color:#a6f821;box-shadow:7px 9px 0px 0px #07261c;">
                    <a href="${appUrl}/dashboard"
                      style="display:block;padding:16px 52px;font-family:'Montserrat',Arial,sans-serif;font-size:20px;font-weight:600;color:#1a1a1a;text-decoration:none;text-align:center;white-space:nowrap;letter-spacing:0.08em;text-transform:uppercase;">
                      Acessar o painel
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td class="warn-cell" style="padding:48px 44px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
                style="background-color:#dddedc;border-radius:10px;box-shadow:3px 3px 0px 0px #a6f821;">
                <tr>
                  <td style="padding:12px 18px;">
                    <table cellpadding="0" cellspacing="0" border="0" role="presentation">
                      <tr>
                        <td width="56" style="vertical-align:middle;padding-right:14px;">
                          <img src="https://app.zaapply.com.br/icon-warning.png" alt="⚠" width="44" height="46" style="display:block;" />
                        </td>
                        <td style="vertical-align:middle;">
                          <p style="margin:0;font-family:'Montserrat',Arial,sans-serif;font-size:15px;font-weight:400;color:#1a1a1a;line-height:1.55;">
                            Dúvidas? Acesse a <strong style="font-weight:600;">Central de Ajuda</strong> ou abra um chamado — nossa equipe responde em até 24 horas úteis.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>

        <table width="600" cellpadding="0" cellspacing="0" border="0" role="presentation">
          <tr>
            <td align="center" style="padding:20px 16px 0;">
              <p style="margin:0;font-family:'Montserrat',Arial,sans-serif;font-size:12px;color:#999999;text-align:center;line-height:1.6;">
                Zaapply &middot;
                <a href="${appUrl}/privacidade" style="color:#999999;text-decoration:underline;">Política de Privacidade</a>
                &middot;
                <a href="${appUrl}/ajuda" style="color:#999999;text-decoration:underline;">Central de Ajuda</a>
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`

  const { data, error } = await client.emails.send({
    from: 'Zaapply <noreply@zaapply.com.br>',
    to: [email],
    subject: `Bem-vindo ao Zaapply, ${nome}!`,
    html,
  })

  if (error) return { success: false, message: error.message }
  return { success: true, data }
}

export async function sendContatoConfirmacaoEmail({
  nome,
  email,
}: {
  nome: string
  email: string
}) {
  const client = getResend()
  if (!client) return { success: false }

  const { data, error } = await client.emails.send({
    from: 'Zaapply <contato@zaapply.com.br>',
    to: [email],
    subject: 'Recebemos seu contato — Zaapply',
    html: zaapplyHtml({
      heading: 'Boa, recebemos sua mensagem!',
      body: `<p style="margin:0 0 20px;color:#444444;font-size:15px;line-height:1.7;">Olá, <strong style="color:#111111;">${nome}</strong>! Ficamos felizes com seu interesse no Zaapply. Nossa equipe entrará em contato em breve pelo email informado.</p><p style="margin:0;color:#6b7280;font-size:14px;line-height:1.7;">Enquanto isso, conheça mais sobre a plataforma em <a href="https://zaapply.com.br" style="color:#15803d;font-weight:600;">zaapply.com.br</a>.</p>`,
      button: { text: 'Conhecer o Zaapply', url: 'https://zaapply.com.br' },
      footer: 'Zaapply · contato@zaapply.com.br',
    }),
  })

  if (error) return { success: false, message: error.message }
  return { success: true, data }
}
