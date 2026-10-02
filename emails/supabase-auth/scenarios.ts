import type { AuthEmailScenario } from './template'

const SITE = '{{ .SiteURL }}'
/** Link pro /api/auth/confirm (verifyOtp direto, sem precisar de cookie/PKCE salvo antes -- funciona mesmo se o e-mail for aberto em outro navegador/aparelho). */
const confirmUrl = (type: 'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change', next: string) =>
  `${SITE}/api/auth/confirm?token_hash={{ .TokenHash }}&type=${type}&next=${next}`

/** Os 6 templates de autenticação -- Authentication > Emails no painel. */
export const AUTH_SCENARIOS: AuthEmailScenario[] = [
  {
    key: 'confirmation',
    label: 'Confirm sign up',
    subject: 'Confirme seu e-mail para começar no Zaapply',
    icon: 'mailCheck',
    title: 'Confirme seu e-mail',
    bodyHtml: `<p style="margin:0;">Falta pouco! Clique no botão abaixo para confirmar seu e-mail e ativar sua conta no Zaapply.</p>`,
    button: { text: 'Confirmar e-mail', url: confirmUrl('signup', '/dashboard') },
  },
  {
    key: 'invite',
    label: 'Invite user',
    subject: 'Você foi convidado para o Zaapply',
    icon: 'userPlus',
    title: 'Você foi convidado',
    bodyHtml: `<p style="margin:0;">Você foi convidado para fazer parte de uma equipe no Zaapply. Clique no botão abaixo para criar sua senha e acessar o painel.</p>`,
    button: { text: 'Aceitar convite', url: confirmUrl('invite', '/reset-password') },
    footerNote: 'Se você não esperava este convite, pode ignorar este e-mail com segurança.',
  },
  {
    key: 'magic_link',
    label: 'Magic link or OTP',
    subject: 'Seu link de acesso ao Zaapply',
    icon: 'bolt',
    title: 'Entrar no Zaapply',
    bodyHtml: `<p style="margin:0;">Clique no botão abaixo para entrar na sua conta sem precisar digitar senha. Esse link é de uso único.</p>`,
    button: { text: 'Entrar agora', url: confirmUrl('magiclink', '/dashboard') },
  },
  {
    key: 'email_change',
    label: 'Change email address',
    subject: 'Confirme seu novo e-mail',
    icon: 'mail',
    title: 'Confirme seu novo e-mail',
    bodyHtml: `<p style="margin:0;">Pediram a troca do e-mail da sua conta para <strong style="color:#0E1512;">{{ .NewEmail }}</strong>. Clique no botão abaixo para confirmar.</p>`,
    button: { text: 'Confirmar novo e-mail', url: confirmUrl('email_change', '/dashboard') },
    footerNote: 'Se você não pediu essa troca, ignore este e-mail -- seu e-mail atual continua o mesmo.',
  },
  {
    key: 'recovery',
    label: 'Reset password',
    subject: 'Redefinir sua senha no Zaapply',
    icon: 'lock',
    title: 'Redefinir sua senha',
    bodyHtml: `<p style="margin:0;">Recebemos um pedido para redefinir a senha da sua conta. Clique no botão abaixo para criar uma senha nova. Esse link expira em 1 hora.</p>`,
    button: { text: 'Criar nova senha', url: confirmUrl('recovery', '/reset-password') },
    footerNote: 'Se você não pediu essa redefinição, pode ignorar este e-mail com segurança -- sua senha continua a mesma.',
  },
  {
    key: 'reauthentication',
    label: 'Reauthentication',
    subject: '{{ .Token }} é seu código de verificação',
    icon: 'shieldCheck',
    title: 'Confirme que é você',
    bodyHtml: `<p style="margin:0;">Pra continuar com essa ação, digite o código abaixo na tela do Zaapply. Ele expira em alguns minutos.</p>`,
    otpToken: '{{ .Token }}',
    showFallbackLink: false,
    footerNote: 'Se você não pediu esse código, pode ignorar este e-mail com segurança.',
  },
]

/** Os 7 templates de notificação de segurança -- Authentication > Emails > Security no painel. */
export const SECURITY_SCENARIOS: AuthEmailScenario[] = [
  {
    key: 'password_changed',
    label: 'Password changed',
    subject: 'Sua senha foi alterada',
    icon: 'lockCheck',
    title: 'Sua senha foi alterada',
    bodyHtml: `<p style="margin:0;">A senha da sua conta no Zaapply foi alterada agora há pouco.</p>`,
    button: { text: 'Não foi você? Redefinir senha', url: `${SITE}/login` },
    footerNote: 'Se não foi você, redefina sua senha agora e fale com o nosso suporte.',
  },
  {
    key: 'email_changed',
    label: 'Email address changed',
    subject: 'Seu e-mail foi alterado',
    icon: 'mailCheck',
    title: 'Seu e-mail foi alterado',
    bodyHtml: `<p style="margin:0;">O e-mail da sua conta foi alterado de <strong style="color:#0E1512;">{{ .OldEmail }}</strong> para <strong style="color:#0E1512;">{{ .Email }}</strong>.</p>`,
    showFallbackLink: false,
    footerNote: 'Se não foi você, fale com o nosso suporte imediatamente: suporte@zaapply.com.br',
  },
  {
    key: 'phone_changed',
    label: 'Phone number changed',
    subject: 'Seu número de WhatsApp foi alterado',
    icon: 'phone',
    title: 'Seu número foi alterado',
    bodyHtml: `<p style="margin:0;">O número da sua conta foi alterado de <strong style="color:#0E1512;">{{ .OldPhone }}</strong> para <strong style="color:#0E1512;">{{ .Phone }}</strong>.</p>`,
    showFallbackLink: false,
    footerNote: 'Se não foi você, fale com o nosso suporte imediatamente: suporte@zaapply.com.br',
  },
  {
    key: 'identity_linked',
    label: 'Sign-in method linked',
    subject: 'Um novo jeito de entrar foi adicionado',
    icon: 'link',
    title: 'Novo jeito de entrar adicionado',
    bodyHtml: `<p style="margin:0;">Sua conta <strong style="color:#0E1512;">{{ .Provider }}</strong> foi vinculada como jeito de entrar em {{ .Email }}.</p>`,
    showFallbackLink: false,
    footerNote: 'Se não foi você, fale com o nosso suporte imediatamente: suporte@zaapply.com.br',
  },
  {
    key: 'identity_unlinked',
    label: 'Sign-in method removed',
    subject: 'Um jeito de entrar foi removido',
    icon: 'unlink',
    title: 'Jeito de entrar removido',
    bodyHtml: `<p style="margin:0;">Sua conta <strong style="color:#0E1512;">{{ .Provider }}</strong> foi removida como jeito de entrar em {{ .Email }}.</p>`,
    showFallbackLink: false,
    footerNote: 'Se não foi você, fale com o nosso suporte imediatamente: suporte@zaapply.com.br',
  },
  {
    key: 'mfa_factor_enrolled',
    label: 'MFA method added',
    subject: 'Nova verificação adicionada à sua conta',
    icon: 'shieldPlus',
    title: 'Nova verificação adicionada',
    bodyHtml: `<p style="margin:0;">O método de verificação <strong style="color:#0E1512;">{{ .FactorType }}</strong> foi adicionado à sua conta.</p>`,
    showFallbackLink: false,
    footerNote: 'Se não foi você, fale com o nosso suporte imediatamente: suporte@zaapply.com.br',
  },
  {
    key: 'mfa_factor_unenrolled',
    label: 'MFA method removed',
    subject: 'Uma verificação foi removida da sua conta',
    icon: 'shieldMinus',
    title: 'Verificação removida',
    bodyHtml: `<p style="margin:0;">O método de verificação <strong style="color:#0E1512;">{{ .FactorType }}</strong> foi removido da sua conta.</p>`,
    showFallbackLink: false,
    footerNote: 'Se não foi você, fale com o nosso suporte imediatamente: suporte@zaapply.com.br',
  },
]

export const ALL_SCENARIOS = [...AUTH_SCENARIOS, ...SECURITY_SCENARIOS]
