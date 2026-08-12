// Submete template ao Meta Business API para aprovação
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const supabase = createServiceClient()

  const { data: template, error: tErr } = await supabase
    .from('hsm_templates')
    .select('*')
    .eq('id', params.id)
    .eq('company_id', context.companyId)
    .single()

  if (tErr || !template) return NextResponse.json({ error: 'Template não encontrado' }, { status: 404 })

  // Busca config do Meta (waba_id + token)
  const { data: numConfig } = await supabase
    .from('meta_wa_numbers')
    .select('waba_id, token')
    .eq('company_id', context.companyId)
    .not('waba_id', 'is', null)
    .not('token', 'is', null)
    .limit(1)
    .maybeSingle()

  if (!numConfig?.waba_id || !numConfig?.token) {
    return NextResponse.json({ error: 'Configure um número com WABA ID e token para submeter templates ao Meta' }, { status: 422 })
  }

  const payload = {
    name: template.name,
    category: template.category.toUpperCase(),
    language: template.language,
    components: [
      {
        type: 'BODY',
        text: template.body,
      },
    ],
  }

  const metaRes = await fetch(
    `https://graph.facebook.com/v21.0/${numConfig.waba_id}/message_templates`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${numConfig.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  )

  const metaData = await metaRes.json()

  if (!metaRes.ok) {
    return NextResponse.json({ error: metaData?.error?.message || 'Erro na API do Meta' }, { status: 422 })
  }

  // Atualiza o template com o ID retornado pelo Meta
  await supabase
    .from('hsm_templates')
    .update({
      meta_template_id: metaData.id ?? null,
      status: 'pendente',
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)

  return NextResponse.json({ ok: true, meta_id: metaData.id, status: 'pendente' })
}
