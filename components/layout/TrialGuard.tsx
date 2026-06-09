'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'

const ALLOWED_PREFIXES = ['/ajuda', '/novidades']
const ALLOWED_EXACT = ['/configuracoes', '/planos']

export function TrialGuard({ trialExpired }: { trialExpired: boolean }) {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!trialExpired) return
    const allowed =
      ALLOWED_PREFIXES.some((p) => pathname?.startsWith(p)) ||
      ALLOWED_EXACT.includes(pathname ?? '')
    if (!allowed) {
      router.replace('/configuracoes?tab=plano&expired=trial')
    }
  }, [trialExpired, pathname, router])

  return null
}
