import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { buildChecklist } from '@/lib/onboarding/model'
import { getChecklistFacts, patchOnboarding, readOnboarding } from '@/lib/onboarding/server'

// GET   /api/onboarding/checklist : dados do card "Primeiros passos" do painel
// PATCH /api/onboarding/checklist : { hidden: true } oculta o card
// Só empresas criadas pelo novo onboarding têm objetivos; nas antigas o card não aparece.
export async function GET(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request)
  if (authError) return authError

  const service = createServiceClient()
  const { data: company } = await service.from('companies').select('onboarding').eq('id', context.companyId).single()
  const ob = readOnboarding(company?.onboarding)

  if (!ob.goals || ob.goals.length === 0 || ob.checklist_hidden) {
    return NextResponse.json({ show: false })
  }

  const items = buildChecklist(ob.goals, await getChecklistFacts(service, context.companyId))
  const done = items.filter((i) => i.done).length
  // Terminou tudo: o cartão some sozinho
  return NextResponse.json({ show: done < items.length, items, done, total: items.length })
}

export async function PATCH(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request)
  if (authError) return authError

  const body = await request.json().catch(() => ({}))
  if (body.hidden !== true) return NextResponse.json({ error: 'Corpo inválido' }, { status: 400 })

  const ok = await patchOnboarding(createServiceClient(), context.companyId, { checklist_hidden: true })
  if (!ok) return NextResponse.json({ error: 'Não foi possível ocultar.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
