'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'

const ALLOWED_PREFIXES = ['/ajuda', '/novidades']
const ALLOWED_EXACT = ['/configuracoes', '/planos']

// reason: 'trial' = teste vencido; 'payment' = conta nova que ainda não pagou o plano escolhido
export function TrialGuard({ trialExpired, reason = 'trial' }: { trialExpired: boolean; reason?: 'trial' | 'payment' }) {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!trialExpired) return
    const allowed =
      ALLOWED_PREFIXES.some((p) => pathname?.startsWith(p)) ||
      ALLOWED_EXACT.includes(pathname ?? '')
    if (!allowed) {
      router.replace(`/configuracoes?tab=plano&expired=${reason}`)
    }
  }, [trialExpired, reason, pathname, router])

  return null
}
