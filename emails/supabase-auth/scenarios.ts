import type { AuthEmailScenario } from './template'

const S = 'stroke="#01573C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"'
const icon = (paths: string) =>
  `<svg width="24" height="24" viewBox="0 0 24 24" style="display:inline-block;vertical-align:middle;">${paths}</svg>`

const ICONS = {
  mail: icon(`<rect x="3" y="5" width="18" height="14" rx="2" ${S}/><path d="m3 7 9 6 9-6" ${S}/>`),
  mailCheck: icon(`<rect x="3" y="5" width="18" height="14" rx="2" ${S}/><path d="m3 7 9 6 9-6" ${S}/><path d="m16 15 2 2 3-4" ${S}/>`),
  userPlus: icon(`<circle cx="9" cy="8" r="3.5" ${S}/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" ${S}/><path d="M18 8v5M20.5 10.5h-5" ${S}/>`),
  bolt: icon(`<path d="M13 3 5 13h6l-1 8 8-10h-6l1-8Z" ${S}/>`),
  lock: icon(`<rect x="5" y="11" width="14" height="9" rx="2" ${S}/><path d="M8 11V7a4 4 0 1 1 8 0v4" ${S}/>`),
  lockCheck: icon(`<rect x="5" y="11" width="14" height="9" rx="2" ${S}/><path d="M8 11V7a4 4 0 1 1 8 0v4" ${S}/><path d="m9.5 15 1.8 1.8L14.5 13" ${S}/>`),
  shieldCheck: icon(`<path d="M12 3 4 6v6c0 5 3.4 8 8 9 4.6-1 8-4 8-9V6l-8-3Z" ${S}/><path d="m8.5 12 2.3 2.3L15.5 9.5" ${S}/>`),
  shieldPlus: icon(`<path d="M12 3 4 6v6c0 5 3.4 8 8 9 4.6-1 8-4 8-9V6l-8-3Z" ${S}/><path d="M12 9v6M9 12h6" ${S}/>`),
  shieldMinus: icon(`<path d="M12 3 4 6v6c0 5 3.4 8 8 9 4.6-1 8-4 8-9V6l-8-3Z" ${S}/><path d="M9 12h6" ${S}/>`),
  phone: icon(`<rect x="7" y="2" width="10" height="20" rx="2" ${S}/><path d="M11 18h2" ${S}/>`),
  link: icon(`<path d="M9 15 15 9" ${S}/><path d="M10 7 13 4a4 4 0 1 1 6 6l-3 3" ${S}/><path d="M14 17l-3 3a4 4 0 1 1-6-6l3-3" ${S}/>`),
  unlink: icon(`<path d="M10 7 13 4a4 4 0 1 1 6 6l-2 2" ${S}/><path d="M14 17l-3 3a4 4 0 1 1-6-6l2-2" ${S}/><path d="m4 4 16 16" ${S}/>`),
}

const SITE = '{{ .SiteURL }}'
const CONFIRM = '{{ .ConfirmationURL }}'

/** Os 6 templates de autenticação -- Authentication > Emails no painel. */
export const AUTH_SCENARIOS: AuthEmailScenario[] = [
  {
    key: 'confirmation',
    label: 'Confirm sign up',
    subject: 'Confirme seu e-mail para começar no Zaapply',
    iconSvg: ICONS.mailCheck,
    title: 'Confirme seu e-mail',
    bodyHtml: `<p style="margin:0;">Falta pouco! Clique no botão abaixo para confirmar seu e-mail e ativar sua conta no Zaapply.</p>`,
    button: { text: 'Confirmar e-mail', url: CONFIRM },
  },
  {
    key: 'invite',
    label: 'Invite user',
    subject: 'Você foi convidado para o Zaapply',
    iconSvg: ICONS.userPlus,
    title: 'Você foi convidado',
    bodyHtml: `<p style="margin:0;">Você foi convidado para fazer parte de uma equipe no Zaapply. Clique no botão abaixo para criar sua senha e acessar o painel.</p>`,
    button: { text: 'Aceitar convite', url: CONFIRM },
    footerNote: 'Se você não esperava este convite, pode ignorar este e-mail com segurança.',
  },
  {
    key: 'magic_link',
    label: 'Magic link or OTP',
    subject: 'Seu link de acesso ao Zaapply',
    iconSvg: ICONS.bolt,
    title: 'Entrar no Zaapply',
    bodyHtml: `<p style="margin:0;">Clique no botão abaixo para entrar na sua conta sem precisar digitar senha. Esse link é de uso único.</p>`,
    button: { text: 'Entrar agora', url: CONFIRM },
  },
  {
    key: 'email_change',
    label: 'Change email address',
    subject: 'Confirme seu novo e-mail',
    iconSvg: ICONS.mail,
    title: 'Confirme seu novo e-mail',
    bodyHtml: `<p style="margin:0;">Pediram a troca do e-mail da sua conta para <strong style="color:#0E1512;">{{ .NewEmail }}</strong>. Clique no botão abaixo para confirmar.</p>`,
    button: { text: 'Confirmar novo e-mail', url: CONFIRM },
    footerNote: 'Se você não pediu essa troca, ignore este e-mail -- seu e-mail atual continua o mesmo.',
  },
  {
    key: 'recovery',
    label: 'Reset password',
    subject: 'Redefinir sua senha no Zaapply',
    iconSvg: ICONS.lock,
    title: 'Redefinir sua senha',
    bodyHtml: `<p style="margin:0;">Recebemos um pedido para redefinir a senha da sua conta. Clique no botão abaixo para criar uma senha nova. Esse link expira em 1 hora.</p>`,
    button: { text: 'Criar nova senha', url: CONFIRM },
    footerNote: 'Se você não pediu essa redefinição, pode ignorar este e-mail com segurança -- sua senha continua a mesma.',
  },
  {
    key: 'reauthentication',
    label: 'Reauthentication',
    subject: '{{ .Token }} é seu código de verificação',
    iconSvg: ICONS.shieldCheck,
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
    iconSvg: ICONS.lockCheck,
    title: 'Sua senha foi alterada',
    bodyHtml: `<p style="margin:0;">A senha da sua conta no Zaapply foi alterada agora há pouco.</p>`,
    button: { text: 'Não foi você? Redefinir senha', url: `${SITE}/login` },
    footerNote: 'Se não foi você, redefina sua senha agora e fale com o nosso suporte.',
  },
  {
    key: 'email_changed',
    label: 'Email address changed',
    subject: 'Seu e-mail foi alterado',
    iconSvg: ICONS.mailCheck,
    title: 'Seu e-mail foi alterado',
    bodyHtml: `<p style="margin:0;">O e-mail da sua conta foi alterado de <strong style="color:#0E1512;">{{ .OldEmail }}</strong> para <strong style="color:#0E1512;">{{ .Email }}</strong>.</p>`,
    showFallbackLink: false,
    footerNote: 'Se não foi você, fale com o nosso suporte imediatamente: suporte@zaapply.com.br',
  },
  {
    key: 'phone_changed',
    label: 'Phone number changed',
    subject: 'Seu número de WhatsApp foi alterado',
    iconSvg: ICONS.phone,
    title: 'Seu número foi alterado',
    bodyHtml: `<p style="margin:0;">O número da sua conta foi alterado de <strong style="color:#0E1512;">{{ .OldPhone }}</strong> para <strong style="color:#0E1512;">{{ .Phone }}</strong>.</p>`,
    showFallbackLink: false,
    footerNote: 'Se não foi você, fale com o nosso suporte imediatamente: suporte@zaapply.com.br',
  },
  {
    key: 'identity_linked',
    label: 'Sign-in method linked',
    subject: 'Um novo jeito de entrar foi adicionado',
    iconSvg: ICONS.link,
    title: 'Novo jeito de entrar adicionado',
    bodyHtml: `<p style="margin:0;">Sua conta <strong style="color:#0E1512;">{{ .Provider }}</strong> foi vinculada como jeito de entrar em {{ .Email }}.</p>`,
    showFallbackLink: false,
    footerNote: 'Se não foi você, fale com o nosso suporte imediatamente: suporte@zaapply.com.br',
  },
  {
    key: 'identity_unlinked',
    label: 'Sign-in method removed',
    subject: 'Um jeito de entrar foi removido',
    iconSvg: ICONS.unlink,
    title: 'Jeito de entrar removido',
    bodyHtml: `<p style="margin:0;">Sua conta <strong style="color:#0E1512;">{{ .Provider }}</strong> foi removida como jeito de entrar em {{ .Email }}.</p>`,
    showFallbackLink: false,
    footerNote: 'Se não foi você, fale com o nosso suporte imediatamente: suporte@zaapply.com.br',
  },
  {
    key: 'mfa_factor_enrolled',
    label: 'MFA method added',
    subject: 'Nova verificação adicionada à sua conta',
    iconSvg: ICONS.shieldPlus,
    title: 'Nova verificação adicionada',
    bodyHtml: `<p style="margin:0;">O método de verificação <strong style="color:#0E1512;">{{ .FactorType }}</strong> foi adicionado à sua conta.</p>`,
    showFallbackLink: false,
    footerNote: 'Se não foi você, fale com o nosso suporte imediatamente: suporte@zaapply.com.br',
  },
  {
    key: 'mfa_factor_unenrolled',
    label: 'MFA method removed',
    subject: 'Uma verificação foi removida da sua conta',
    iconSvg: ICONS.shieldMinus,
    title: 'Verificação removida',
    bodyHtml: `<p style="margin:0;">O método de verificação <strong style="color:#0E1512;">{{ .FactorType }}</strong> foi removido da sua conta.</p>`,
    showFallbackLink: false,
    footerNote: 'Se não foi você, fale com o nosso suporte imediatamente: suporte@zaapply.com.br',
  },
]

export const ALL_SCENARIOS = [...AUTH_SCENARIOS, ...SECURITY_SCENARIOS]
