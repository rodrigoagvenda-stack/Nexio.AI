'use client'

import { useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'

const ALLOWED_PREFIXES = ['/ajuda', '/novidades']
const ALLOWED_EXACT = ['/configuracoes', '/planos']

// reason: 'trial' = teste vencido; 'payment' = conta nova que ainda não pagou o plano escolhido
export function TrialGuard({ trialExpired, reason = 'trial' }: { trialExpired: boolean; reason?: 'trial' | 'payment' }) {
  const router = useRouter()
  const pathname = usePathname()
  // Redireciona no máximo uma vez por caminho: sem isso, o "voltar" do navegador
  // disputa com o redirect do servidor e a tela recarrega em ciclo.
  const redirectedFrom = useRef<string | null>(null)

  useEffect(() => {
    if (!trialExpired) return
    const allowed =
      ALLOWED_PREFIXES.some((p) => pathname?.startsWith(p)) ||
      ALLOWED_EXACT.includes(pathname ?? '')
    if (allowed) {
      redirectedFrom.current = null
      return
    }
    if (redirectedFrom.current === pathname) return
    redirectedFrom.current = pathname
    router.replace(`/configuracoes?tab=plano&expired=${reason}`)
  }, [trialExpired, reason, pathname, router])

  return null
}
