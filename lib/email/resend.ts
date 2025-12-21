import { Resend } from 'resend';

// Lazy initialization to avoid build-time errors
let resend: Resend | null = null;

function getResend() {
  if (!resend && process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
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
