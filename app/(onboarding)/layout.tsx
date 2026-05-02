import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Configurar conta | Nexio.AI',
}

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {children}
    </div>
  )
}
