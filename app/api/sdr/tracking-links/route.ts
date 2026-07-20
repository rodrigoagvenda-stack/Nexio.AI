import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// GET /api/sdr/tracking-links — lista links rastreados da empresa
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data: userData } = await supabase
      .from('users').select('company_id').eq('auth_user_id', user.id).single()
    if (!userData) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    const service = createServiceClient()
    const { data: links, error } = await service
      .from('tracking_links')
      .select('id, slug, phone, mensagem, utm_campaign, utm_source, utm_medium, utm_content, cliques, criado_em')
      .eq('company_id', userData.company_id)
      .order('criado_em', { ascending: false })

    if (error) throw error
    return NextResponse.json({ links: links ?? [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/sdr/tracking-links — cria novo link rastreado
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data: userData } = await supabase
      .from('users').select('company_id').eq('auth_user_id', user.id).single()
    if (!userData) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    const body = await req.json()
    const { phone, mensagem, utm_campaign, utm_source, utm_medium, utm_content } = body

    if (!phone) return NextResponse.json({ error: 'Telefone obrigatório' }, { status: 400 })
    if (!utm_campaign && !utm_source) {
      return NextResponse.json({ error: 'Informe ao menos campanha ou fonte' }, { status: 400 })
    }

    // Gera slug único de 8 chars
    const slug = Math.random().toString(36).slice(2, 10)

    const service = createServiceClient()
    const { data: link, error } = await service
      .from('tracking_links')
      .insert({
        company_id: userData.company_id,
        slug,
        phone: phone.replace(/\D/g, ''),
        mensagem: mensagem || null,
        utm_campaign: utm_campaign || null,
        utm_source: utm_source || null,
        utm_medium: utm_medium || null,
        utm_content: utm_content || null,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ link })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE /api/sdr/tracking-links?id=123 — apaga link rastreado
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data: userData } = await supabase
      .from('users').select('company_id').eq('auth_user_id', user.id).single()
    if (!userData) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

    const service = createServiceClient()
    const { error } = await service
      .from('tracking_links')
      .delete()
      .eq('id', parseInt(id, 10))
      .eq('company_id', userData.company_id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
