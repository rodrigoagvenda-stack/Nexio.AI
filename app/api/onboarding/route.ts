import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { randomUUID } from 'crypto'
import { sendWelcomeEmail } from '@/lib/email/resend'

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

    const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    // 1. Cria a empresa — novas contas sempre iniciam em trial de 7 dias (sem SDR/Canvas)
    let companyId: number

    const { data: company, error: companyErr } = await service
      .from('companies')
      .insert({
        name: companyName.trim(),
        email: userEmail,
        phone: companyPhone?.trim() || null,
        plan_type: 'trial',
        plan_name: 'trial',
        is_active: true,
        trial_enabled: true,
        trial_ends_at: trialEndsAt,
        image_url: logoUrl || null,
      })
      .select('id')
      .single()

    if (companyErr) {
      // Duplicate email → vincula ao registro existente em vez de falhar
      const isDuplicate = companyErr.code === '23505' || companyErr.message?.includes('companies_email_key')
      if (!isDuplicate) {
        console.error('[onboarding] company insert:', companyErr)
        throw new Error('Não foi possível criar sua conta. Tente novamente.')
      }
      const { data: existingCompany } = await service
        .from('companies')
        .select('id')
        .eq('email', userEmail)
        .maybeSingle()
      if (!existingCompany) throw new Error('Conta não encontrada. Entre em contato com o suporte.')
      companyId = existingCompany.id
    } else {
      companyId = company!.id
    }

    // 2. Cria o usuário — user_id é NOT NULL, usa o auth UUID
    const { error: userErr } = await service
      .from('users')
      .upsert({
        auth_user_id: user.id,
        user_id: user.id,
        company_id: companyId,
        name: userDisplayName,
        email: userEmail,
        role: 'admin',
        department: segment || null,
        is_active: true,
      }, { onConflict: 'auth_user_id' })

    if (userErr) {
      console.error('[onboarding] user upsert:', userErr)
      throw new Error('Não foi possível criar seu usuário. Tente novamente.')
    }

    // Envia email de boas-vindas (fire-and-forget, não bloqueia o retorno)
    sendWelcomeEmail({
      nome: userDisplayName,
      email: userEmail,
      companyName: companyName.trim(),
      isTrial: true,
    }).catch(() => {})

    return NextResponse.json({ success: true, companyId })
  } catch (err: any) {
    console.error('[onboarding] FATAL:', err?.message, err?.details, err?.hint)
    return NextResponse.json(
      { error: err?.message || 'Não foi possível criar sua conta. Tente novamente.' },
      { status: 500 }
    )
  }
}
