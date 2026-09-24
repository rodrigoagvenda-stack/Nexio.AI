import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { PAID_PLAN_TYPES, buildChecklist } from '@/lib/onboarding/model'
import { getChecklistFacts, readOnboarding } from '@/lib/onboarding/server'

// GET /api/onboarding/state : em que ponto do onboarding a pessoa está.
//   stage 'company'  : ainda não tem empresa (passos 1 a 3)
//   stage 'payment'  : tem empresa, falta o pagamento do plano escolhido
//   stage 'finish'   : pagou, falta o passo final ("Tudo certo")
//   stage 'done'     : nada a fazer aqui, segue para o painel
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const service = createServiceClient()
  const { data: dbUser } = await service.from('users').select('company_id, name').eq('auth_user_id', user.id).maybeSingle()

  const email = user.email ?? ''
  if (!dbUser?.company_id) {
    return NextResponse.json({ stage: 'company', email, name: dbUser?.name ?? user.user_metadata?.full_name ?? '' })
  }

  const { data: company } = await service
    .from('companies')
    .select('id, name, plan_type, onboarding')
    .eq('id', dbUser.company_id)
    .single()
  if (!company) return NextResponse.json({ stage: 'company', email, name: '' })

  const ob = readOnboarding(company.onboarding)
  const paid = PAID_PLAN_TYPES.includes(company.plan_type ?? '')

  if (!ob.pending_finish) return NextResponse.json({ stage: 'done', email })
  if (!paid) return NextResponse.json({ stage: 'payment', email, plan: ob.plan_intent ?? 'pro' })

  const facts = await getChecklistFacts(service, company.id)
  return NextResponse.json({
    stage: 'finish',
    email,
    companyName: company.name,
    items: buildChecklist(ob.goals ?? [], facts),
  })
}
