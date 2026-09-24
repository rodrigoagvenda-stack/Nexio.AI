import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Configurar conta | Zaapply',
}

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: '#0C0C0C' }}>
      {children}
    </div>
  )
}
