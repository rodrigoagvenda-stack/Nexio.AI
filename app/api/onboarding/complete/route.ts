import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendWelcomeEmail } from '@/lib/email/resend'
import { sanitizeGoals, sanitizePlan } from '@/lib/onboarding/model'

// POST /api/onboarding/complete : cria a empresa e o primeiro usuário (admin) depois dos passos 1 a 3.
//
// A empresa nasce SEM plano pago: o plano escolhido fica só como intenção (onboarding.plan_intent) e a conta
// fica travada em Configuração > Plano até o pagamento ser confirmado (o webhook do Asaas grava o plano).
// Antes, escolher "pro" ou "starter" aqui gravava o plano pago na hora, sem pagamento.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

    const service = createServiceClient()

    // Idempotente: um duplo clique ou uma segunda tentativa não cria outra empresa
    const { data: existing } = await service
      .from('users')
      .select('company_id')
      .eq('auth_user_id', user.id)
      .maybeSingle()
    if (existing?.company_id) {
      return NextResponse.json({ ok: true, companyId: existing.company_id, alreadyExists: true })
    }

    const body = await request.json().catch(() => ({}))
    const companyName = typeof body.companyName === 'string' ? body.companyName.trim() : ''
    const userName = typeof body.userName === 'string' ? body.userName.trim() : ''
    const segment = typeof body.segment === 'string' ? body.segment.trim().slice(0, 60) : ''
    const logoUrl = typeof body.logoUrl === 'string' && body.logoUrl.startsWith('https://') ? body.logoUrl : null
    const goals = sanitizeGoals(body.goals)
    const plan = sanitizePlan(body.selectedPlan)

    if (companyName.length < 2 || companyName.length > 120) {
      return NextResponse.json({ error: 'Informe o nome da empresa.' }, { status: 400 })
    }
    if (!plan) {
      return NextResponse.json({ error: 'Escolha um plano para continuar.' }, { status: 400 })
    }

    const email = user.email ?? ''

    const { data: company, error: compErr } = await service.from('companies').insert({
      name: companyName,
      email,
      // Sem plano pago: fica travada até o pagamento. trial_ends_at no passado aciona a trava do painel
      // (o teste grátis só existe quando o admin libera, por empresa: trial_enabled continua falso).
      plan_type: 'trial',
      plan_name: 'trial',
      trial_enabled: false,
      trial_ends_at: new Date(Date.now() - 60_000).toISOString(),
      image_url: logoUrl,
      is_active: true,
      agente_ativo: false,
      allow_uazapi: false,
      onboarding: { goals, plan_intent: plan, pending_finish: true },
    }).select('id').single()

    if (compErr || !company) {
      console.error('[onboarding/complete] company insert:', compErr)
      return NextResponse.json({ error: 'Não foi possível criar sua conta. Tente novamente.' }, { status: 500 })
    }

    // Etiquetas de sistema (Follow up / No-show / Promoção) : toda empresa nova já nasce com elas
    await service.from('tags').insert([
      { company_id: company.id, tag_name: 'Follow up', tag_color: '#3b82f6' },
      { company_id: company.id, tag_name: 'No-show', tag_color: '#ef4444' },
      { company_id: company.id, tag_name: 'Promoção', tag_color: '#f59e0b' },
    ])

    const { error: userErr } = await service.from('users').upsert({
      auth_user_id: user.id,
      user_id: user.id,
      email,
      name: userName || user.user_metadata?.full_name || email.split('@')[0],
      company_id: company.id,
      role: 'admin',
      department: segment || null,
      is_active: true,
    }, { onConflict: 'auth_user_id' })

    if (userErr) {
      console.error('[onboarding/complete] user upsert:', userErr)
      // não deixa uma empresa órfã para trás: a próxima tentativa começa limpa
      await service.from('tags').delete().eq('company_id', company.id)
      await service.from('companies').delete().eq('id', company.id)
      return NextResponse.json({ error: 'Não foi possível criar seu usuário. Tente novamente.' }, { status: 500 })
    }

    sendWelcomeEmail({
      nome: userName || email.split('@')[0],
      email,
      companyName,
      isTrial: false,
    }).catch(() => {})

    return NextResponse.json({ ok: true, companyId: company.id, next: `/configuracoes?tab=plano&pagar=${plan}` })
  } catch (err: any) {
    console.error('[onboarding/complete] FATAL:', err?.message)
    return NextResponse.json({ error: 'Erro interno. Tente novamente.' }, { status: 500 })
  }
}
