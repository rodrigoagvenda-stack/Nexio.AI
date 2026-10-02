/**
 * Template-base dos e-mails de autenticação/segurança do Supabase Auth, fiel ao
 * layout aprovado no Paper (arquivo "Drenageo - GV", página "Teste", artboard
 * "E-mail v1 - Reset password (mestre)"). HTML de e-mail de verdade -- tabela,
 * estilo inline, sem flexbox/box-shadow/SVG no logo -- não o HTML/CSS moderno
 * que o Paper gera, porque isso quebra no Outlook e no Gmail mobile.
 *
 * Variáveis do Supabase (Go template, {{ .Algo }}) entram como string literal
 * no `body`/`buttonUrl`/`otpToken` -- o Supabase substitui na hora de enviar.
 */

export interface AuthEmailScenario {
  /** Chave do template no painel da Supabase (Authentication > Emails ou > Security). */
  key: string
  /** Nome como aparece na lista do painel, só para referência humana. */
  label: string
  subject: string
  /** Ícone decorativo do selo (SVG inline -- alguns clientes removem; degrada pra bolinha verde vazia, sem quebrar o layout). */
  iconSvg: string
  title: string
  /** HTML simples (parágrafos) -- pode conter {{ .Variavel }} do Supabase. */
  bodyHtml: string
  /** Sem botão = e-mail só informativo (ex.: notificação de segurança). */
  button?: { text: string; url: string }
  /** Para Reauthentication: mostra o código OTP em destaque em vez de botão. */
  otpToken?: string
  /** Mostra a linha "copie e cole o link" com o href do botão. Default true quando há botão. */
  showFallbackLink?: boolean
  /** Rodapé de aviso, dentro do card. Default: aviso genérico de "se não foi você". */
  footerNote?: string
}

const LOGO_URL = 'https://app.zaapply.com.br/logo-email.png'

export function renderAuthEmail(s: AuthEmailScenario): string {
  const showLink = s.showFallbackLink ?? !!s.button

  const ctaBlock = s.button
    ? `
          <tr>
            <td align="left" style="padding:28px 48px 0;">
              <table cellpadding="0" cellspacing="0" border="0" role="presentation">
                <tr>
                  <td class="btn-cell" style="background-color:#01573C;box-shadow:0 3px 0 #013825;border-radius:999px;">
                    <a href="${s.button.url}" style="display:block;padding:16px 28px;font-family:'Inter',Arial,sans-serif;font-size:16px;font-weight:700;color:#FFFFFF;text-decoration:none;text-align:center;white-space:nowrap;border-radius:999px;">${s.button.text}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`
    : ''

  const otpBlock = s.otpToken
    ? `
          <tr>
            <td align="left" style="padding:28px 48px 0;">
              <table cellpadding="0" cellspacing="0" border="0" role="presentation">
                <tr>
                  <td style="background-color:#F5F7F6;border:1px solid #E2E7E4;border-radius:14px;padding:18px 32px;">
                    <span style="font-family:'Inter',Arial,sans-serif;font-size:32px;font-weight:700;letter-spacing:0.12em;color:#0E1512;">${s.otpToken}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`
    : ''

  const fallbackLinkBlock = showLink && s.button
    ? `
          <tr>
            <td align="left" style="padding:28px 48px 0;">
              <p style="margin:0;font-family:'Inter',Arial,sans-serif;font-size:13px;line-height:18px;color:#8A948E;">Se o botão não funcionar, copie e cole este link no navegador:</p>
              <p style="margin:4px 0 0 0;font-family:'Inter',Arial,sans-serif;font-size:13px;line-height:18px;color:#01573C;word-break:break-all;">${s.button.url}</p>
            </td>
          </tr>`
    : ''

  const footerNote = s.footerNote ?? 'Se você não pediu essa ação, pode ignorar este e-mail com segurança.'

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${s.title}</title>
<style>
  body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
  table,td{mso-table-lspace:0pt;mso-table-rspace:0pt;}
  img{-ms-interpolation-mode:bicubic;border:0;outline:none;text-decoration:none;}
  body{margin:0!important;padding:0!important;background-color:#EEF2F0;}
  @media only screen and (max-width:600px){
    .card{width:100%!important;border-radius:0!important;}
    .outer-pad{padding:24px 0!important;}
    .pad-48{padding-left:24px!important;padding-right:24px!important;}
    .title-text{font-size:22px!important;line-height:28px!important;}
    .btn-cell a{font-size:15px!important;padding:14px 24px!important;}
  }
</style>
</head>
<body>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="background-color:#EEF2F0;">
    <tr>
      <td align="center" class="outer-pad" style="padding:40px 0;">

        <table class="card" width="600" cellpadding="0" cellspacing="0" border="0" role="presentation" style="background-color:#FFFFFF;border:1px solid #E2E7E4;border-radius:20px;overflow:hidden;">
          <tr>
            <td class="pad-48" align="left" style="padding:36px 48px 0;">
              <img src="${LOGO_URL}" width="140" height="45" alt="Zaapply" style="display:block;" />
            </td>
          </tr>
          <tr>
            <td class="pad-48" align="left" style="padding:28px 48px 0;">
              <table cellpadding="0" cellspacing="0" border="0" role="presentation">
                <tr>
                  <td width="56" height="56" style="background-color:#E3F1EA;border-radius:28px;text-align:center;vertical-align:middle;">
                    ${s.iconSvg}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="pad-48" align="left" style="padding:20px 48px 0;">
              <h1 class="title-text" style="margin:0;font-family:'Inter',Arial,sans-serif;font-size:26px;font-weight:700;line-height:32px;letter-spacing:-0.02em;color:#0E1512;">${s.title}</h1>
            </td>
          </tr>
          <tr>
            <td class="pad-48" align="left" style="padding:16px 48px 0;">
              <div style="font-family:'Inter',Arial,sans-serif;font-size:16px;font-weight:400;line-height:24px;color:#5B6660;">${s.bodyHtml}</div>
            </td>
          </tr>
          ${ctaBlock}
          ${otpBlock}
          ${fallbackLinkBlock}
          <tr>
            <td class="pad-48" style="padding:32px 48px 0;">
              <div style="width:100%;height:1px;background-color:#E2E7E4;"></div>
            </td>
          </tr>
          <tr>
            <td class="pad-48" align="left" style="padding:24px 48px 48px;">
              <p style="margin:0;font-family:'Inter',Arial,sans-serif;font-size:13px;line-height:20px;color:#8A948E;">${footerNote}</p>
            </td>
          </tr>
        </table>

        <table width="600" cellpadding="0" cellspacing="0" border="0" role="presentation">
          <tr>
            <td align="center" style="padding:24px 16px 0;">
              <p style="margin:0;font-family:'Inter',Arial,sans-serif;font-size:13px;color:#8A948E;text-align:center;line-height:18px;">Zaapply</p>
              <p style="margin:4px 0 0;font-family:'Inter',Arial,sans-serif;font-size:13px;color:#B7C2BC;text-align:center;line-height:18px;">Dúvidas? Fale com a gente em suporte@zaapply.com.br</p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`
}
