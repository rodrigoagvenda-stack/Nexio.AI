import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { patchOnboarding } from '@/lib/onboarding/server'

// POST /api/onboarding/finish : "Ir para o painel" ou "Fazer isso depois" no passo final.
// A partir daqui o painel deixa de mandar a pessoa de volta para o onboarding.
export async function POST(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request)
  if (authError) return authError

  const ok = await patchOnboarding(createServiceClient(), context.companyId, { pending_finish: false })
  if (!ok) return NextResponse.json({ error: 'Não foi possível concluir. Tente de novo.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
