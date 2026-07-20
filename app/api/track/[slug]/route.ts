import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// GET /api/track/:slug — captura UTMs e redireciona para WhatsApp
export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const { slug } = params
  const supabase = createServiceClient()

  const { data: link, error } = await supabase
    .from('tracking_links')
    .select('phone, mensagem, utm_campaign, utm_source, utm_medium, utm_content, company_id')
    .eq('slug', slug)
    .single()

  if (error || !link) {
    return NextResponse.redirect('https://wa.me/')
  }

  // Incrementa cliques (fire-and-forget)
  supabase
    .from('tracking_links')
    .update({ cliques: supabase.rpc('increment', { row_id: slug }) })
    .eq('slug', slug)
    .then(() => {})

  // Salva evento de clique para atribuição posterior
  const clickedAt = new Date().toISOString()
  supabase.from('tracking_link_clicks').insert({
    slug,
    company_id: link.company_id,
    utm_campaign: link.utm_campaign,
    utm_source: link.utm_source,
    utm_medium: link.utm_medium,
    utm_content: link.utm_content,
    clicked_at: clickedAt,
  }).then(() => {})

  // Monta URL do WhatsApp com mensagem pré-preenchida
  const phone = link.phone.replace(/\D/g, '')
  const text = link.mensagem ? encodeURIComponent(link.mensagem) : ''
  const waUrl = `https://wa.me/${phone}${text ? `?text=${text}` : ''}`

  return NextResponse.redirect(waUrl)
}
