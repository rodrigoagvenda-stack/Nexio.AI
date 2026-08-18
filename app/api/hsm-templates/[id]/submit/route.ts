// Submete template ao Meta Business API para aprovação
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { safeDecrypt } from '@/lib/crypto'

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

  // Busca WABA ID + token do número Meta conectado de verdade (mesma conexão
  // usada pra enviar/receber mensagem, ver MetaWhatsAppConnect em
  // configuracoes/sdr) — não da tabela meta_wa_numbers, que é um formulário
  // manual desconectado do motor do SDR.
  const { data: sdrConfig } = await supabase
    .from('sdr_configs')
    .select('meta_wa_waba_id, meta_wa_token')
    .eq('company_id', context.companyId)
    .maybeSingle()

  if (!sdrConfig?.meta_wa_waba_id || !sdrConfig?.meta_wa_token) {
    return NextResponse.json({ error: 'Conecte o WhatsApp via Meta Cloud API (Automações → Agente SDR → Integrações) antes de submeter templates' }, { status: 422 })
  }

  const metaToken = safeDecrypt(sdrConfig.meta_wa_token)

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
    `https://graph.facebook.com/v21.0/${sdrConfig.meta_wa_waba_id}/message_templates`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${metaToken}`,
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
