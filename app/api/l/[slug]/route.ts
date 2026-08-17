import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// POST /api/l/:slug : versão da rota de tracking que primeiro captura telefone + gclid
// (chamada pela landing app/l/[slug]/page.tsx antes de redirecionar pro WhatsApp)
export async function POST(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params
  const { slug } = params
  const supabase = createServiceClient()

  const body = await req.json().catch(() => ({}))
  const phone = typeof body.phone === 'string' ? body.phone.replace(/\D/g, '') : ''
  const gclid = typeof body.gclid === 'string' && body.gclid.length > 0 ? body.gclid : null

  const { data: link, error } = await supabase
    .from('tracking_links')
    .select('phone, mensagem, utm_campaign, utm_source, utm_medium, utm_content, company_id')
    .eq('slug', slug)
    .single()

  if (error || !link) {
    return NextResponse.json({ error: 'Link não encontrado' }, { status: 404 })
  }

  if (!phone) {
    return NextResponse.json({ error: 'Telefone obrigatório' }, { status: 400 })
  }

  supabase
    .from('tracking_links')
    .update({ cliques: supabase.rpc('increment', { row_id: slug }) })
    .eq('slug', slug)
    .then(() => {})

  await supabase.from('tracking_link_clicks').insert({
    slug,
    company_id: link.company_id,
    utm_campaign: link.utm_campaign,
    utm_source: link.utm_source,
    utm_medium: link.utm_medium,
    utm_content: link.utm_content,
    clicked_at: new Date().toISOString(),
    gclid,
    captured_phone: phone,
  })

  const waPhone = link.phone.replace(/\D/g, '')
  const text = link.mensagem ? encodeURIComponent(link.mensagem) : ''
  const waUrl = `https://wa.me/${waPhone}${text ? `?text=${text}` : ''}`

  return NextResponse.json({ waUrl })
}
