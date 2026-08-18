// Submete template ao Meta Business API para aprovação
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { safeDecrypt } from '@/lib/crypto'
import { getMetaMediaHandle } from '@/lib/sdr/meta-template-upload'
import { buildTemplateComponents, validateCarouselStructure, type CarouselCardSpec } from '@/lib/meta/hsm-components'

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
  const kind: 'simple' | 'buttons' | 'carousel' = template.kind ?? 'simple'

  // Resolve handles de mídia (Resumable Upload API) antes de montar o
  // payload : header simples e cada card do carrossel, se tiverem mídia.
  let headerHandle: string | null = template.header_handle ?? null
  let carouselCards: CarouselCardSpec[] | null = null

  try {
    if (kind === 'simple' && template.header_type && template.header_type !== 'none' && template.header_media_url) {
      if (!headerHandle) headerHandle = await getMetaMediaHandle(template.header_media_url, metaToken)
    }

    if (kind === 'carousel') {
      const rawCards = (template.carousel_cards ?? []) as Array<{
        header_type: 'image' | 'video'
        media_url: string
        header_handle?: string | null
        body_text: string
        buttons: CarouselCardSpec['buttons']
      }>

      const structErr = validateCarouselStructure(
        rawCards.map((c) => ({ ...c, header_handle: c.header_handle ?? '' }))
      )
      if (structErr) return NextResponse.json({ error: structErr }, { status: 422 })

      carouselCards = await Promise.all(
        rawCards.map(async (c) => ({
          header_type: c.header_type,
          media_url: c.media_url, // preserva : Peça 4/6 precisam reenviar essa mídia a cada envio (a Meta reexige, o handle de criação não serve pra isso)
          header_handle: c.header_handle || (await getMetaMediaHandle(c.media_url, metaToken)),
          body_text: c.body_text,
          buttons: c.buttons,
        }))
      )
    }
  } catch (e: any) {
    return NextResponse.json({ error: `Falha ao subir mídia pra Meta: ${e.message}` }, { status: 422 })
  }

  let components: unknown[]
  try {
    components = buildTemplateComponents({
      kind,
      body: template.body,
      header_type: template.header_type,
      header_handle: headerHandle,
      buttons: template.buttons,
      carousel_cards: carouselCards,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 422 })
  }

  const payload = {
    name: template.name,
    category: template.category.toUpperCase(),
    language: template.language,
    components,
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

  // Atualiza o template com o ID retornado pelo Meta e cacheia os handles
  // resolvidos (evita reupload em caso de resubmissão após rejeição)
  await supabase
    .from('hsm_templates')
    .update({
      meta_template_id: metaData.id ?? null,
      status: 'pendente',
      header_handle: headerHandle,
      carousel_cards: carouselCards ?? template.carousel_cards,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)

  return NextResponse.json({ ok: true, meta_id: metaData.id, status: 'pendente' })
}
