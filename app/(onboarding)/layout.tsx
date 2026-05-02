import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Configurar conta | Nexio.AI',
}

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      {children}
    </div>
  )
}
