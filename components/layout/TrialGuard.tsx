'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'

// Páginas permitidas mesmo com trial expirado
const ALLOWED_PATHS = ['/configuracoes', '/ajuda', '/novidades']

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
    const allowed = ALLOWED_PATHS.some((p) => pathname?.startsWith(p))
    if (!allowed) {
      router.replace('/configuracoes?tab=plano&expired=trial')
    }
  }, [isTrial, trialEndsAt, pathname, router])

  return null
}
