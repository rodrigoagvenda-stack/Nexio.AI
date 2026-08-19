import { redirect } from 'next/navigation'

// Conteúdo desta página foi promovido para /dashboard (auditoria de UX:
// existiam dois dashboards de vendas com fontes de dado diferentes,
// acessíveis de lugares diferentes do menu -- fundidos em um só).
export default function TimeDashboardRedirect() {
  redirect('/dashboard')
}
