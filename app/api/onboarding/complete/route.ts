import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

    const body = await request.json()
    const { companyName, userName, selectedPlan, logoUrl, userEmail } = body

    if (!companyName?.trim()) {
      return NextResponse.json({ error: 'Nome da empresa é obrigatório.' }, { status: 400 })
    }

    const service = createServiceClient()

    const isTrial = selectedPlan === 'trial'

    const { data: company, error: compErr } = await service.from('companies').insert({
      name: companyName.trim(),
      email: userEmail || user.email,
      plan_type: isTrial ? 'trial' : selectedPlan === 'pro' ? 'pro' : selectedPlan === 'scale' ? 'scale' : 'starter',
      image_url: logoUrl ?? null,
      is_active: true,
      agente_ativo: false,
      ...(isTrial && {
        trial_enabled: true,
        trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    }).select('id').single()

    if (compErr) return NextResponse.json({ error: compErr.message }, { status: 500 })

    const { error: userErr } = await service.from('users').upsert({
      auth_user_id: user.id,
      user_id: user.id,
      email: userEmail || user.email,
      name: userName?.trim() || (userEmail || user.email || '').split('@')[0],
      company_id: company.id,
      role: 'admin',
    }, { onConflict: 'auth_user_id' })

    if (userErr) return NextResponse.json({ error: userErr.message }, { status: 500 })

    return NextResponse.json({ ok: true, companyId: company.id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno.' }, { status: 500 })
  }
}
