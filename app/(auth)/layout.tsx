import type { Metadata } from 'next'
import { AuthTheme } from '@/components/brand/AuthTheme'

export const metadata: Metadata = {
  title: 'Zaapli — Entrar',
  description: 'Sistema completo de CRM com automação e inteligência artificial',
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AuthTheme />
      {children}
    </>
  )
}
