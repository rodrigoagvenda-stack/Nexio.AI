import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// POST /api/onboarding — cria company + user para novos usuários
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const service = createServiceClient()

    // Garante idempotência: se já tem registro, só retorna
    const { data: existing } = await service
      .from('users')
      .select('id, company_id')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (existing?.company_id) {
      return NextResponse.json({ success: true, companyId: existing.company_id, alreadyExists: true })
    }

    const body = await req.json()
    const {
      companyName,
      companyPhone,
      segment,
      companySize,
      userName,
      planType = 'starter',
      logoUrl,
    } = body

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
      console.error('[onboarding] company insert error:', companyErr)
      throw companyErr ?? new Error('Erro ao criar empresa')
    }

    // 2. Cria o usuário vinculado à empresa
    const { error: userErr } = await service
      .from('users')
      .upsert({
        auth_user_id: user.id,
        company_id: company.id,
        name: userDisplayName,
        email: userEmail,
        role: 'admin',
        department: segment || null,
      }, { onConflict: 'auth_user_id' })

    if (userErr) {
      console.error('[onboarding] user upsert error:', userErr)
      // Tenta limpar empresa criada
      await service.from('companies').delete().eq('id', company.id)
      throw userErr
    }

    // 3. Salva metadata extra na empresa se precisar (segmento, tamanho)
    if (segment || companySize) {
      await service.from('companies').update({
        ...(segment ? { plan_features: [segment] } : {}),
      }).eq('id', company.id)
    }

    return NextResponse.json({ success: true, companyId: company.id })
  } catch (err: any) {
    console.error('[onboarding]', err)
    return NextResponse.json({ error: 'Não foi possível criar sua conta. Tente novamente.' }, { status: 500 })
  }
}
