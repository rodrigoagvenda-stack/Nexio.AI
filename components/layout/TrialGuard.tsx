'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'

// Sub-rotas permitidas por prefixo
const ALLOWED_PREFIXES = ['/ajuda', '/novidades']
// Exact match — só a rota base, NÃO sub-rotas (/configuracoes/sdr etc ficam bloqueadas)
const ALLOWED_EXACT = ['/configuracoes', '/planos']

export function TrialGuard({
  isTrial,
  trialEndsAt,
}: {
  isTrial: boolean
  trialEndsAt: string | null
}) {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!isTrial || !trialEndsAt) return
    const expired = new Date(trialEndsAt) < new Date()
    if (!expired) return
    const allowed =
      ALLOWED_PREFIXES.some((p) => pathname?.startsWith(p)) ||
      ALLOWED_EXACT.includes(pathname ?? '')
    if (!allowed) {
      router.replace('/configuracoes?tab=plano&expired=trial')
    }
  }, [isTrial, trialEndsAt, pathname, router])

  return null
}
