import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { randomUUID } from 'crypto'

// POST /api/onboarding — cria company + user para novos usuários
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const service = createServiceClient()

    // Idempotência: se já existe, retorna
    const { data: existing } = await service
      .from('users')
      .select('id, company_id')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (existing?.company_id) {
      return NextResponse.json({ success: true, companyId: existing.company_id, alreadyExists: true })
    }

    const body = await req.json()
    const { companyName, companyPhone, segment, companySize, userName, planType = 'basic', logoUrl } = body

    if (!companyName?.trim()) {
      return NextResponse.json({ error: 'Nome da empresa é obrigatório' }, { status: 400 })
    }

    const userEmail = user.email ?? ''
    const userDisplayName = userName?.trim() || user.user_metadata?.full_name || userEmail.split('@')[0]

    // 1. Cria a empresa
    const { data: company, error: companyErr } = await service
      .from('companies')
      .insert({
        name: companyName.trim(),
        email: userEmail,
        phone: companyPhone?.trim() || null,
        plan_type: planType,
        plan_name: planType,
        is_active: true,
        image_url: logoUrl || null,
      })
      .select('id')
      .single()

    if (companyErr || !company) {
      console.error('[onboarding] company insert:', companyErr)
      throw companyErr ?? new Error('Erro ao criar empresa')
    }

    // 2. Cria o usuário — user_id é NOT NULL, usa o auth UUID
    const { error: userErr } = await service
      .from('users')
      .upsert({
        auth_user_id: user.id,
        user_id: user.id,          // campo NOT NULL obrigatório
        company_id: company.id,
        name: userDisplayName,
        email: userEmail,
        role: 'admin',
        department: segment || null,
        is_active: true,
      }, { onConflict: 'auth_user_id' })

    if (userErr) {
      console.error('[onboarding] user upsert:', userErr)
      await service.from('companies').delete().eq('id', company.id)
      throw userErr
    }

    return NextResponse.json({ success: true, companyId: company.id })
  } catch (err: any) {
    console.error('[onboarding] FATAL:', err?.message, err?.details, err?.hint)
    return NextResponse.json(
      { error: err?.message || 'Não foi possível criar sua conta. Tente novamente.' },
      { status: 500 }
    )
  }
}
